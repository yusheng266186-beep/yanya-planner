# Yanya · 30-Day Chinese Teaching Study Planner

[中文说明](README.md) · [Open the planner](https://yusheng266186-beep.github.io/yanya-planner/)

Yanya is a small progressive web app for preparing for the Chinese-language teaching track. It combines a thirty-day plan, daily check-ins, a focus timer, mood notes, and weekly reviews.

## First session

1. Open the planner and read the current stage and today's tasks on the dashboard.
2. Check off a task or start a focus session. The daily and weekly views draw from the same progress data.
3. On a supported mobile browser, use the browser menu to add the planner to the home screen. Load its resources once online before testing offline reopening.

Study records, timer information, and mood notes live in the current browser's local storage. A different browser, a private session, or cleared site data starts with its own state. Use another copy of the plan or notes if they need to survive a browser reset.

## Customize or host

| File | Responsibility |
| --- | --- |
| <code>index.html</code> | Screen layout and accessible entry points |
| <code>assets/data.js</code> | Study dates, stages, tasks, and reference content |
| <code>assets/app.js</code> | Views, check-ins, timer, review, and storage |
| <code>manifest.json</code> and <code>sw.js</code> | PWA installation and offline cache |

No build step is needed. Serve the repository to verify installation and offline behavior:

~~~bash
python3 -m http.server 8080
~~~

Open <http://localhost:8080/>. When editing the study plan, keep the dashboard, plan, check-ins, and reviews on the same dates. Bump the service-worker cache name when changing cached assets and verify a second visit from an installed shortcut.

The original application code is under [MIT](LICENSE). Study references retain their respective source terms. The plan is a personal study aid whose dates can be adapted for the next cycle.
