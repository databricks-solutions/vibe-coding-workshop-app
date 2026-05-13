# Architecture — Required Design Outputs

This directory contains the four design artifacts that document V2V's
identity, authorization, and dependency posture. They are modelled on the
required design outputs from the
[Databricks Apps Well-Architected Framework](https://github.com/tushar-madan_data/databricks-apps_well-architected)
(WAF):

| Doc | Question it answers |
|-----|---------------------|
| [auth-routing.md](./auth-routing.md) | Which **identity** does each outbound call use? |
| [permission-chain.md](./permission-chain.md) | What is the **end-to-end privilege trace** for a sensitive operation? |
| [audit-plan.md](./audit-plan.md) | Where does the **audit trail** live and how is it queried? |
| [dependency-contract.md](./dependency-contract.md) | Which Databricks services are **required vs optional**? What is the degraded-mode behavior? |

These docs describe the system as it exists today, not as we wish it
existed. Gaps are flagged inline with **TODO** markers and tracked in
[../gaps/](../gaps/). When V2V's code changes, the relevant doc here must
change in the same PR.
