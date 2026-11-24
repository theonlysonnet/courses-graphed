# UW–Madison Electrical Engineering BS — Course Dependency Graph & Degree Planner

An interactive Next.js application for visualizing the **2026–2027 University of Wisconsin–Madison Electrical Engineering, BS** curriculum as a prerequisite dependency graph, alongside a live graduation requirements audit, 8-semester sample plan, and searchable course catalog.

## Features

- **Interactive Dependency Graph (`@xyflow/react` + `@dagrejs/dagre`)**:
  - Switch between **Left → Right**, **Top → Bottom**, and **4-Year Swimlane** layouts.
  - Filter by **Core & Foundations**, **All EE Courses**, **Labs**, **Professional Electives**, any of the **6 EE Specialty Areas**, or **Named Options** (*Machine Learning & Data Science*, *Semiconductor Engineering*).
  - Click any course to open the **Course Inspector**, highlight transitive prerequisites and unlocked downstream courses, inspect nested AND/OR prerequisite trees, and isolate its dependency cone.
  - Track *Not Taken*, *In Progress* (including concurrent-enrollment co-req support), and *Completed* courses in `localStorage` to see what unlocks next.
- **Graduation Requirements Audit**:
  - Live **120-credit** progress tracking across Mathematics (16 cr + Advanced Math auxiliary), Science (17–18 cr), EE Core (32 cr), EE Advanced Electives (24 cr across ≥ 3 of 6 areas, ≥ 2 labs incl. `E C E 301–317`, ≥ 9 cr 400+ ECE, 1 Capstone), Professional Electives (9 cr), Communication Skills (6 cr), Liberal Studies (15 cr), Free Elective (1 cr), and Named Options.
  - Reference summaries for University Core GenEd & Residency, College of Engineering Progression & Cross-Campus Transfer, and Honors in Research.
- **4-Year Sample Plan & Course Catalog Table**:
  - Official 8-semester Sample Four-Year Plan synced with your completed/in-progress courses.
  - Searchable, filterable semantic table of all 138 EE BS curriculum courses (plus 59 external foundational prerequisites).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Refreshing Curriculum Data

Course descriptions, credits, and prerequisite ASTs are scraped from the official UW–Madison Guide (`guide.wisc.edu`) into `src/data/ee-curriculum.json`:

```bash
node scripts/scrape-ee-curriculum.mjs
```
