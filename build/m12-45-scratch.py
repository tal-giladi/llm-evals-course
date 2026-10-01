# Throwaway for lessons 12.4 / 12.5. Deleted when the two lessons are done.
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "labs" / "common"))

from evallab import TraceStore, load, record  # noqa: E402
from evallab.stats import hash_seed  # noqa: E402

data = load("support")

print("=== dev ids, first 6 ===")
print([i.id for i in data.items_for("dev")[:6]])
oos20 = [i.id for i in data.items_for("dev")[:20] if (i.slice or {}).get("out_of_scope")]
oosall = [i.id for i in data.items_for("dev") if (i.slice or {}).get("out_of_scope")]
print("out_of_scope in first 20 dev:", oos20)
print("out_of_scope in all dev:", oosall)

print("\n=== does the sampler drop errored traces? ===")
out = record(data, n=40, split="dev", sample_rate=0.25, fail_rate=0.10, seed=3)
st = TraceStore.from_traces(out)
print("kept:", len(out), "of 40")
print("error_rate:", st.error_rate())

items40 = data.items_for("dev")[:40]
failed = [it.id for it in items40 if hash_seed(f"3:{it.id}") % 1000 < 100]
kept_ids = [t["trace_id"] for t in out]
print("failed ids at seed=3 fail_rate=0.10:", failed)
print("failed ids kept:", [f for f in failed if f"tr_{f}" in kept_ids])
print("failed ids dropped:", [f for f in failed if f"tr_{f}" not in kept_ids])

print("\n=== sessions, default id ===")
base = record(data, n=20, split="dev", seed=1)
print(TraceStore.from_traces(base).sessions())

print("\n=== chat-only subset: what an auto-instrumenter would have ===")
full = TraceStore.from_traces(base)
chat = TraceStore.from_traces([
    {"trace_id": t["trace_id"], "spans": [s for s in t["spans"] if s["kind"] == "chat"]}
    for t in base])
print("chat-only traces:", len(chat), "spans:", len(chat.spans()))
print("cost:", chat.total_cost(), "tokens:", chat.total_tokens())
print("latency:", chat.latency())
print("error_rate:", chat.error_rate())
print("sessions:", chat.sessions())
print("root attrs:", full.spans("agent")[0].attributes)
print("chat attrs keys:", sorted(chat.spans()[0].attributes))
print("root attrs keys:", sorted(full.spans("agent")[0].attributes))
print("tool attrs keys:", sorted(full.spans("execute_tool")[0].attributes))
print("chain attrs keys:", sorted(full.spans("chain")[0].attributes))

print("\n=== does pip see opentelemetry / mlflow? ===")
for mod in ("opentelemetry", "mlflow", "openai", "anthropic", "instructor"):
    try:
        __import__(mod)
        print(mod, "IMPORTABLE")
    except ImportError:
        print(mod, "not installed")