---
'@cherrystudio/ai-core': patch
---

Add DeepSeek and Jina as web search providers. DeepSeek uses the `/v1/tools/search` API with server-side page content (`need_content`); Jina uses the `s.jina.ai` SERP API which also returns fetched page content by default. Both map excluded domains to `-site:` operators, clamp result counts to their API limits, and are enrolled for existing installs via migration 214.
