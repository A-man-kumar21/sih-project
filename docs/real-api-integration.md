# Real API integration seam

The mock adapter contract will be deliberately limited to normalized compliance results (`status`, `last_updated`, `raw_fields`). Production adapters may need to add:

- authenticated request context and consent artifacts;
- source request/correlation IDs, rate-limit and retry metadata;
- document or credential provenance, signatures, and verification timestamps;
- source-specific error states (unavailable, pending, consent denied) distinct from non-compliance.

The normalized scoring result should remain stable while source payload schemas evolve.
