# P08 — School Result Processing and GPA Engine

Academic result processing and verification using the published P08 fixture.

## Run

Open `index.html` in a browser. No server is required.

Optional:

```bash
python -m http.server 8080
```

Then visit http://localhost:8080

## What it does

- Defaults to **PUB-01** (`?case=PUB-02` still loads another published case)
- Two classes from the fixture (**Class 9** / **Class 10**), six compulsory subjects plus one optional
- GPA from compulsory grade points plus optional bonus, with **R-11 / R-12 / R-13 / R-10**
- Per-student **Trace** (marks, grade point, rule, uncancelled GPA)
- Checking lists: optional GP ≤ 2.00, practical &lt; 8, absence (R-29)
