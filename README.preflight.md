# Trae Preflight

This folder is prepared for `wangxt-955-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18255
- API_PORT: 19255
- WEB_PORT: 20255
- DB_PORT: 21255
- REDIS_PORT: 22255

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
