import type {
  AreaId,
  AuditRuleCheck,
  AuditSection,
  Course,
  DegreeAuditReport,
  ManualCredits,
  NamedOptionId,
} from "@/types/curriculum";

export const DEFAULT_MANUAL_CREDITS: ManualCredits = {
  liberalStudies: 0,
  freeElective: 0,
  additionalProfElective: 0,
  additionalAdvElective: 0,
  placedOutCommA: false,
  placedOutQrA: false,
  genEdHumanities6: false,
  genEdSocialSci3: false,
  genEdEthnicStudies3: false,
  genEdCivics3: false,
  genEdNatSciLab: false,
  residency30: false,
  languageReq: false,
};

export const EE_CORE_IDS = [
  "E C E 203",
  "E C E 210",
  "E C E 222",
  "E C E 230",
  "E C E 235",
  "E C E 252",
  "E C E 270",
  "E C E 271",
  "E C E 330",
  "E C E 340",
  "E C E 352",
  "E C E 370",
] as const;

export const CAPSTONE_IDS = ["E C E 453", "E C E 454", "E C E 455", "E C E 554"] as const;

export const SIX_SPECIALTY_AREAS: AreaId[] = [
  "fields_waves",
  "systems_control",
  "power_machines",
  "comm_sp",
  "circuits_devices",
  "computers_computing",
];

export const AREA_LABELS: Record<AreaId, string> = {
  lab: "Laboratory",
  fields_waves: "Fields & Waves",
  systems_control: "Systems & Control",
  power_machines: "Power & Machines",
  comm_sp: "Communications & Signal Processing",
  circuits_devices: "Circuits & Devices",
  computers_computing: "Computers & Computing",
};

const PROB_STAT_IDS = ["STAT 311", "STAT 424", "MATH 431", "E C E 331"];
const PHYS_1_IDS = ["PHYSICS 201", "PHYSICS 207", "PHYSICS 247"];
const PHYS_2_IDS = ["PHYSICS 202", "PHYSICS 208", "PHYSICS 248"];
const CHEM_IDS = ["CHEM 109", "CHEM 103", "CHEM 104"];
const COMM_1_IDS = ["INTEREGR 156", "ENGL 100", "LSC 100", "COM ARTS 100", "COM ARTS 181", "ESL 118"];
const ADV_MATH_AUX_IDS = [
  "MATH 319",
  "MATH 320",
  "MATH 340",
  "MATH 341",
  "MATH 345",
  "MATH 375",
  "MATH 376",
  "E C E 334",
  "E C E 532",
];

/**
 * Computes a complete 2026-2027 UW-Madison Electrical Engineering BS degree audit.
 */
export function computeDegreeAudit(
  courses: Course[],
  completedIds: Set<string>,
  inProgressIds: Set<string>,
  manual: ManualCredits,
  selectedOption: NamedOptionId
): DegreeAuditReport {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const plannedIds = new Set([...completedIds, ...inProgressIds]);
  const warnings: string[] = [];

  const cr = (id: string) => byId.get(id)?.credits ?? 0;
  const sumCredits = (ids: Iterable<string>, set: Set<string>) => {
    let total = 0;
    for (const id of ids) {
      if (set.has(id)) total += cr(id);
    }
    return total;
  };

  // Track which courses are already allocated to Math/Science/Core/Comm so we don't double-count
  const allocatedIds = new Set<string>();

  // --- 1. MATHEMATICS (16 cr) ---
  const has375_376_done = completedIds.has("MATH 375") && completedIds.has("MATH 376");
  const has375_376_plan = plannedIds.has("MATH 375") && plannedIds.has("MATH 376");

  const mathCoreComp =
    (completedIds.has("MATH 221") ? cr("MATH 221") : 0) +
    (completedIds.has("MATH 222") ? cr("MATH 222") : 0) +
    (completedIds.has("MATH 234") ? cr("MATH 234") : has375_376_done ? 4 : 0);
  const mathCorePlan =
    (plannedIds.has("MATH 221") ? cr("MATH 221") : 0) +
    (plannedIds.has("MATH 222") ? cr("MATH 222") : 0) +
    (plannedIds.has("MATH 234") ? cr("MATH 234") : has375_376_plan ? 4 : 0);

  const probChosenDone = PROB_STAT_IDS.find((id) => completedIds.has(id));
  const probChosenPlan = PROB_STAT_IDS.find((id) => plannedIds.has(id));
  const probCrDone = probChosenDone ? cr(probChosenDone) : 0;
  const probCrPlan = probChosenPlan ? cr(probChosenPlan) : 0;

  ["MATH 221", "MATH 222", "MATH 234"].forEach((id) => {
    if (plannedIds.has(id)) allocatedIds.add(id);
  });
  if (probChosenPlan) allocatedIds.add(probChosenPlan);

  // Advanced math auxiliary condition
  const advMathDone =
    has375_376_done || ADV_MATH_AUX_IDS.some((id) => completedIds.has(id));
  const advMathPlan =
    has375_376_plan || ADV_MATH_AUX_IDS.some((id) => plannedIds.has(id));

  if (plannedIds.has("MATH 320") && plannedIds.has("MATH 340")) {
    warnings.push(
      "MATH 320 and MATH 340 cannot both earn degree credit — choose only one."
    );
  }

  const mathDoneCr = mathCoreComp + probCrDone;
  const mathPlanCr = mathCorePlan + probCrPlan;
  const mathRules: AuditRuleCheck[] = [
    {
      id: "math-calc1",
      label: "MATH 221 (Calculus 1, 5 cr)",
      satisfied: completedIds.has("MATH 221"),
      inProgressSatisfied: plannedIds.has("MATH 221"),
      detail: completedIds.has("MATH 221") ? "Completed" : plannedIds.has("MATH 221") ? "In Progress" : "Needed",
    },
    {
      id: "math-calc2",
      label: "MATH 222 (Calculus 2, 4 cr)",
      satisfied: completedIds.has("MATH 222"),
      inProgressSatisfied: plannedIds.has("MATH 222"),
      detail: completedIds.has("MATH 222") ? "Completed" : plannedIds.has("MATH 222") ? "In Progress" : "Needed",
    },
    {
      id: "math-calc3",
      label: "MATH 234 (Multivariable Calculus, 4 cr) or MATH 375+376",
      satisfied: completedIds.has("MATH 234") || has375_376_done,
      inProgressSatisfied: plannedIds.has("MATH 234") || has375_376_plan,
      detail: completedIds.has("MATH 234")
        ? "MATH 234"
        : has375_376_done
          ? "MATH 375+376"
          : plannedIds.has("MATH 234")
            ? "In Progress"
            : "Needed",
    },
    {
      id: "math-prob",
      label: "Probability & Statistics (STAT 311, 424, MATH 431, or E C E 331)",
      satisfied: Boolean(probChosenDone),
      inProgressSatisfied: Boolean(probChosenPlan),
      detail: probChosenDone ? `${probChosenDone}` : probChosenPlan ? `${probChosenPlan} (In Progress)` : "Needed",
    },
    {
      id: "math-adv-aux",
      label: "Advanced Math Auxiliary Condition (MATH 319/320/340/341/345, E C E 334 or 532)",
      satisfied: advMathDone,
      inProgressSatisfied: advMathPlan,
      detail: advMathDone
        ? `Met via ${ADV_MATH_AUX_IDS.find((id) => completedIds.has(id)) || "MATH 375+376"}`
        : advMathPlan
          ? "In Progress"
          : "Counts toward Adv or Prof Electives",
    },
  ];

  const mathSection: AuditSection = {
    id: "math",
    title: "Mathematics",
    requiredCredits: 16,
    completedCredits: mathDoneCr,
    inProgressCredits: Math.max(0, mathPlanCr - mathDoneCr),
    satisfied: mathRules.slice(0, 4).every((r) => r.satisfied) && advMathDone,
    inProgressSatisfied: mathRules.slice(0, 4).every((r) => r.inProgressSatisfied) && advMathPlan,
    summary: `${mathDoneCr} / 16 cr completed`,
    rules: mathRules,
    matchedCourses: ["MATH 221", "MATH 222", "MATH 234", ...(probChosenPlan ? [probChosenPlan] : [])].filter((id) =>
      plannedIds.has(id)
    ),
  };

  // --- 2. SCIENCE (17-18 cr) ---
  const hasEmaDone = completedIds.has("E M A 201") && completedIds.has("E M A 202");
  const hasEmaPlan = plannedIds.has("E M A 201") && plannedIds.has("E M A 202");
  const phys1Done = PHYS_1_IDS.find((id) => completedIds.has(id));
  const phys1Plan = PHYS_1_IDS.find((id) => plannedIds.has(id));
  const phys2Done = PHYS_2_IDS.find((id) => completedIds.has(id));
  const phys2Plan = PHYS_2_IDS.find((id) => plannedIds.has(id));
  const chemDone = CHEM_IDS.find((id) => completedIds.has(id));
  const chemPlan = CHEM_IDS.find((id) => plannedIds.has(id));

  const sciMatchedPlan = [
    ...(plannedIds.has("COMP SCI 300") ? ["COMP SCI 300"] : []),
    ...(phys1Plan ? [phys1Plan] : hasEmaPlan ? ["E M A 201", "E M A 202"] : []),
    ...(phys2Plan ? [phys2Plan] : []),
    ...(chemPlan ? [chemPlan] : []),
  ];
  sciMatchedPlan.forEach((id) => allocatedIds.add(id));

  const sciDoneCr =
    (completedIds.has("COMP SCI 300") ? cr("COMP SCI 300") : 0) +
    (phys1Done ? cr(phys1Done) : hasEmaDone ? 6 : 0) +
    (phys2Done ? cr(phys2Done) : 0) +
    (chemDone ? cr(chemDone) : 0);
  const sciPlanCr =
    (plannedIds.has("COMP SCI 300") ? cr("COMP SCI 300") : 0) +
    (phys1Plan ? cr(phys1Plan) : hasEmaPlan ? 6 : 0) +
    (phys2Plan ? cr(phys2Plan) : 0) +
    (chemPlan ? cr(chemPlan) : 0);

  const sciRules: AuditRuleCheck[] = [
    {
      id: "sci-cs300",
      label: "COMP SCI 300 (Programming II, 3 cr)",
      satisfied: completedIds.has("COMP SCI 300"),
      inProgressSatisfied: plannedIds.has("COMP SCI 300"),
      detail: completedIds.has("COMP SCI 300") ? "Completed" : plannedIds.has("COMP SCI 300") ? "In Progress" : "Needed",
    },
    {
      id: "sci-phys1",
      label: "Physics I (PHYSICS 201, 207, 247, or E M A 201+202)",
      satisfied: Boolean(phys1Done) || hasEmaDone,
      inProgressSatisfied: Boolean(phys1Plan) || hasEmaPlan,
      detail: phys1Done || (hasEmaDone ? "E M A 201+202" : phys1Plan ? `${phys1Plan} (In Progress)` : "Needed"),
    },
    {
      id: "sci-phys2",
      label: "Physics II (PHYSICS 202, 208, or 248)",
      satisfied: Boolean(phys2Done),
      inProgressSatisfied: Boolean(phys2Plan),
      detail: phys2Done || (phys2Plan ? `${phys2Plan} (In Progress)` : "Needed"),
    },
    {
      id: "sci-chem",
      label: "Chemistry (CHEM 109 [5 cr], 103 [4 cr], or 104 [5 cr])",
      satisfied: Boolean(chemDone),
      inProgressSatisfied: Boolean(chemPlan),
      detail: chemDone || (chemPlan ? `${chemPlan} (In Progress)` : "Needed"),
    },
  ];

  const scienceSection: AuditSection = {
    id: "science",
    title: "Science",
    requiredCredits: 17,
    completedCredits: sciDoneCr,
    inProgressCredits: Math.max(0, sciPlanCr - sciDoneCr),
    satisfied: sciRules.every((r) => r.satisfied),
    inProgressSatisfied: sciRules.every((r) => r.inProgressSatisfied),
    summary: `${sciDoneCr} / 17–18 cr completed`,
    rules: sciRules,
    matchedCourses: sciMatchedPlan,
  };

  // --- 3. ELECTRICAL ENGINEERING CORE (32 cr) ---
  EE_CORE_IDS.forEach((id) => {
    if (plannedIds.has(id)) allocatedIds.add(id);
  });
  const coreDoneCr = sumCredits(EE_CORE_IDS, completedIds);
  const corePlanCr = sumCredits(EE_CORE_IDS, plannedIds);
  const coreDoneCount = EE_CORE_IDS.filter((id) => completedIds.has(id)).length;
  const corePlanCount = EE_CORE_IDS.filter((id) => plannedIds.has(id)).length;

  const coreSection: AuditSection = {
    id: "core",
    title: "Electrical Engineering Core",
    requiredCredits: 32,
    completedCredits: coreDoneCr,
    inProgressCredits: Math.max(0, corePlanCr - coreDoneCr),
    satisfied: coreDoneCount === EE_CORE_IDS.length,
    inProgressSatisfied: corePlanCount === EE_CORE_IDS.length,
    summary: `${coreDoneCount} / ${EE_CORE_IDS.length} courses (${coreDoneCr} / 32 cr)`,
    rules: EE_CORE_IDS.map((id) => ({
      id: `core-${id}`,
      label: `${id} — ${byId.get(id)?.title || ""}`,
      satisfied: completedIds.has(id),
      inProgressSatisfied: plannedIds.has(id),
      detail: completedIds.has(id) ? `${cr(id)} cr` : plannedIds.has(id) ? "In Progress" : `${cr(id)} cr needed`,
    })),
    matchedCourses: EE_CORE_IDS.filter((id) => plannedIds.has(id)),
  };

  // --- 4. COMMUNICATION SKILLS (6 cr) ---
  const comm1Done = COMM_1_IDS.find((id) => completedIds.has(id));
  const comm1Plan = COMM_1_IDS.find((id) => plannedIds.has(id));
  if (comm1Plan) allocatedIds.add(comm1Plan);
  if (plannedIds.has("INTEREGR 397")) allocatedIds.add("INTEREGR 397");

  const comm1DoneMet = Boolean(comm1Done) || manual.placedOutCommA;
  const comm1PlanMet = Boolean(comm1Plan) || manual.placedOutCommA;
  const commDoneCr = (comm1Done ? cr(comm1Done) : 0) + (completedIds.has("INTEREGR 397") ? 3 : 0);
  const commPlanCr = (comm1Plan ? cr(comm1Plan) : 0) + (plannedIds.has("INTEREGR 397") ? 3 : 0);

  const commSection: AuditSection = {
    id: "comm",
    title: "Communication Skills",
    requiredCredits: 6,
    completedCredits: commDoneCr,
    inProgressCredits: Math.max(0, commPlanCr - commDoneCr),
    satisfied: comm1DoneMet && completedIds.has("INTEREGR 397"),
    inProgressSatisfied: comm1PlanMet && plannedIds.has("INTEREGR 397"),
    summary: `${commDoneCr} / 6 cr${manual.placedOutCommA ? " (Comm A placed out)" : ""}`,
    rules: [
      {
        id: "comm-1",
        label: "Engr Comm 1 (INTEREGR 156, ENGL 100, LSC 100, COM ARTS 100/181, ESL 118, or placement)",
        satisfied: comm1DoneMet,
        inProgressSatisfied: comm1PlanMet,
        detail: manual.placedOutCommA
          ? "Satisfied by Placement"
          : comm1Done || (comm1Plan ? `${comm1Plan} (In Progress)` : "Needed"),
      },
      {
        id: "comm-2",
        label: "Engr Comm 2: INTEREGR 397 (Engineering Communication, 3 cr)",
        satisfied: completedIds.has("INTEREGR 397"),
        inProgressSatisfied: plannedIds.has("INTEREGR 397"),
        detail: completedIds.has("INTEREGR 397")
          ? "Completed"
          : plannedIds.has("INTEREGR 397")
            ? "In Progress"
            : "Needed (Junior+ standing)",
      },
    ],
    matchedCourses: [comm1Plan, plannedIds.has("INTEREGR 397") ? "INTEREGR 397" : undefined].filter(
      (x): x is string => Boolean(x)
    ),
  };

  // --- 5. EE ADVANCED ELECTIVES (24 cr) ---
  // Note: courses already allocated (like E C E 331 used for Math Prob/Stat) cannot double-count as Adv Elective credits
  const advEligibleCourses = courses.filter(
    (c) =>
      c.categories.includes("adv_elective") &&
      !c.isCore &&
      !allocatedIds.has(c.id)
  );
  const advSelectedDone = advEligibleCourses.filter((c) => completedIds.has(c.id));
  const advSelectedPlan = advEligibleCourses.filter((c) => plannedIds.has(c.id));

  // If >1 capstone selected, warn because E C E 453/454/455/554 are mutually exclusive
  const capstonesPlanned = CAPSTONE_IDS.filter((id) => plannedIds.has(id));
  if (capstonesPlanned.length > 1) {
    warnings.push(
      `Multiple capstone courses selected (${capstonesPlanned.join(", ")}). UW-Madison forbids taking more than one of E C E 453, 454, 455, 554 for credit.`
    );
  }

  const advDoneCr = advSelectedDone.reduce((s, c) => s + c.credits, 0) + manual.additionalAdvElective;
  const advPlanCr = advSelectedPlan.reduce((s, c) => s + c.credits, 0) + manual.additionalAdvElective;
  advSelectedPlan.forEach((c) => allocatedIds.add(c.id));

  const areaStats = (list: Course[]) => {
    const coveredAreas = new Set<AreaId>();
    let areaCredits = 0;
    for (const c of list) {
      const specialtyAreas = c.areas.filter((a) => SIX_SPECIALTY_AREAS.includes(a));
      if (specialtyAreas.length > 0) {
        areaCredits += c.credits;
        specialtyAreas.forEach((a) => coveredAreas.add(a));
      }
    }
    return { coveredAreas, areaCredits };
  };

  const advAreasDone = areaStats(advSelectedDone);
  const advAreasPlan = areaStats(advSelectedPlan);

  const labsDone = advSelectedDone.filter((c) => c.isLab);
  const labsPlan = advSelectedPlan.filter((c) => c.isLab);
  const lab301Done = labsDone.some((c) => c.is301to317Lab);
  const lab301Plan = labsPlan.some((c) => c.is301to317Lab);

  const ece400DoneCr = advSelectedDone
    .filter((c) => c.is400PlusEce)
    .reduce((s, c) => s + c.credits, 0);
  const ece400PlanCr = advSelectedPlan
    .filter((c) => c.is400PlusEce)
    .reduce((s, c) => s + c.credits, 0);

  const capstoneDone = CAPSTONE_IDS.find((id) => completedIds.has(id));
  const capstonePlan = CAPSTONE_IDS.find((id) => plannedIds.has(id));

  const advRules: AuditRuleCheck[] = [
    {
      id: "adv-total",
      label: "Total Advanced Elective Credits (≥ 24 cr)",
      satisfied: advDoneCr >= 24,
      inProgressSatisfied: advPlanCr >= 24,
      detail: `${advDoneCr} / 24 cr`,
    },
    {
      id: "adv-3areas",
      label: "At least 21 credits across ≥ 3 of the 6 specialty areas",
      satisfied: advAreasDone.areaCredits >= 21 && advAreasDone.coveredAreas.size >= 3,
      inProgressSatisfied: advAreasPlan.areaCredits >= 21 && advAreasPlan.coveredAreas.size >= 3,
      detail: `${advAreasDone.areaCredits}/21 cr in ${advAreasDone.coveredAreas.size}/3 areas`,
    },
    {
      id: "adv-labs",
      label: "At least 2 Lab courses (including ≥ 1 from E C E 301–317)",
      satisfied: labsDone.length >= 2 && lab301Done,
      inProgressSatisfied: labsPlan.length >= 2 && lab301Plan,
      detail: `${labsDone.length}/2 labs (${lab301Done ? "301–317 met" : "need 301–317"})`,
    },
    {
      id: "adv-400",
      label: "At least 9 credits in E C E courses numbered 400+",
      satisfied: ece400DoneCr >= 9,
      inProgressSatisfied: ece400PlanCr >= 9,
      detail: `${ece400DoneCr} / 9 cr`,
    },
    {
      id: "adv-capstone",
      label: "Capstone Design Course (E C E 453, 454, 455, or 554)",
      satisfied: Boolean(capstoneDone),
      inProgressSatisfied: Boolean(capstonePlan),
      detail: capstoneDone || (capstonePlan ? `${capstonePlan} (In Progress)` : "Needed"),
    },
  ];

  const advSection: AuditSection = {
    id: "adv_electives",
    title: "Electrical Engineering Advanced Electives",
    requiredCredits: 24,
    completedCredits: advDoneCr,
    inProgressCredits: Math.max(0, advPlanCr - advDoneCr),
    satisfied: advRules.every((r) => r.satisfied),
    inProgressSatisfied: advRules.every((r) => r.inProgressSatisfied),
    summary: `${advDoneCr} / 24 cr • ${advAreasDone.coveredAreas.size}/3 areas • ${labsDone.length}/2 labs`,
    rules: advRules,
    matchedCourses: advSelectedPlan.map((c) => c.id),
  };

  // --- 6. PROFESSIONAL ELECTIVES (9 cr) ---
  // Courses in prof_elective / adv_math_aux not already allocated, PLUS overflow credits from
  // adv_elective courses eligible for prof_electives beyond the 24-credit Adv Elective minimum.
  const profEligible = courses.filter(
    (c) =>
      !allocatedIds.has(c.id) &&
      (c.categories.includes("prof_elective") || c.isAdvMathAux)
  );
  const profDoneCourses = profEligible.filter((c) => completedIds.has(c.id));
  const profPlanCourses = profEligible.filter((c) => plannedIds.has(c.id));

  // Eligible overflow from Advanced Electives (>24 cr) where the course is also Prof Elective eligible
  const advProfOverflowPoolDone = advSelectedDone
    .filter((c) => c.categories.includes("prof_elective") || c.is400PlusEce)
    .reduce((s, c) => s + c.credits, 0);
  const advProfOverflowPoolPlan = advSelectedPlan
    .filter((c) => c.categories.includes("prof_elective") || c.is400PlusEce)
    .reduce((s, c) => s + c.credits, 0);

  const advOverflowDone = Math.min(Math.max(0, advDoneCr - 24), advProfOverflowPoolDone);
  const advOverflowPlan = Math.min(Math.max(0, advPlanCr - 24), advProfOverflowPoolPlan);

  // If MATH 375+376 used, MATH 375 (5) + MATH 376 (5) = 10 cr, where 4 cr fulfilled MATH 234 leaving 6 cr for Prof Elective
  const extra375CrDone = has375_376_done ? 6 : 0;
  const extra375CrPlan = has375_376_plan ? 6 : 0;

  const profDoneCr =
    profDoneCourses.reduce((s, c) => s + c.credits, 0) +
    advOverflowDone +
    extra375CrDone +
    manual.additionalProfElective;
  const profPlanCr =
    profPlanCourses.reduce((s, c) => s + c.credits, 0) +
    advOverflowPlan +
    extra375CrPlan +
    manual.additionalProfElective;

  const profMatchedList = [
    ...profPlanCourses.map((c) => c.id),
    ...(advOverflowPlan > 0 ? [`(+${advOverflowPlan} cr Adv Elec overflow)`] : []),
  ];

  const profSection: AuditSection = {
    id: "prof_electives",
    title: "Professional Electives",
    requiredCredits: 9,
    completedCredits: profDoneCr,
    inProgressCredits: Math.max(0, profPlanCr - profDoneCr),
    satisfied: profDoneCr >= 9,
    inProgressSatisfied: profPlanCr >= 9,
    summary: `${profDoneCr} / 9 cr`,
    rules: [
      {
        id: "prof-9cr",
        label: "9 credits of eligible professional electives (non-double-counted)",
        satisfied: profDoneCr >= 9,
        inProgressSatisfied: profPlanCr >= 9,
        detail: `${profDoneCr} / 9 cr (${profMatchedList.join(", ") || "none selected"})`,
      },
    ],
    matchedCourses: profPlanCourses.map((c) => c.id),
  };

  // --- 7. LIBERAL STUDIES ELECTIVES (15 cr) ---
  const libCr = manual.liberalStudies;
  const libRules: AuditRuleCheck[] = [
    {
      id: "lib-15cr",
      label: "15 credits of CoE Liberal Studies Electives",
      satisfied: libCr >= 15,
      inProgressSatisfied: libCr >= 15,
      detail: `${libCr} / 15 cr`,
    },
    {
      id: "lib-hum",
      label: "≥ 6 credits Humanities / Arts / Literature",
      satisfied: manual.genEdHumanities6,
      inProgressSatisfied: manual.genEdHumanities6,
      detail: manual.genEdHumanities6 ? "Checked" : "Unchecked",
    },
    {
      id: "lib-soc",
      label: "≥ 3 credits Social & Behavioral Sciences",
      satisfied: manual.genEdSocialSci3,
      inProgressSatisfied: manual.genEdSocialSci3,
      detail: manual.genEdSocialSci3 ? "Checked" : "Unchecked",
    },
    {
      id: "lib-es",
      label: "≥ 3 credits Ethnic Studies (can overlap Hum/SocSci)",
      satisfied: manual.genEdEthnicStudies3,
      inProgressSatisfied: manual.genEdEthnicStudies3,
      detail: manual.genEdEthnicStudies3 ? "Checked" : "Unchecked",
    },
  ];
  const libSection: AuditSection = {
    id: "liberal_studies",
    title: "Liberal Studies Electives",
    requiredCredits: 15,
    completedCredits: libCr,
    inProgressCredits: 0,
    satisfied: libCr >= 15 && manual.genEdHumanities6 && manual.genEdSocialSci3 && manual.genEdEthnicStudies3,
    inProgressSatisfied: libCr >= 15 && manual.genEdHumanities6 && manual.genEdSocialSci3 && manual.genEdEthnicStudies3,
    summary: `${libCr} / 15 cr`,
    rules: libRules,
    matchedCourses: [],
  };

  // --- 8. FREE ELECTIVE (1 cr) ---
  const freeSection: AuditSection = {
    id: "free_elective",
    title: "Free Elective",
    requiredCredits: 1,
    completedCredits: manual.freeElective,
    inProgressCredits: 0,
    satisfied: manual.freeElective >= 1,
    inProgressSatisfied: manual.freeElective >= 1,
    summary: `${manual.freeElective} / 1 cr`,
    rules: [
      {
        id: "free-1cr",
        label: "At least 1 free elective credit (to reach 120+ total)",
        satisfied: manual.freeElective >= 1,
        inProgressSatisfied: manual.freeElective >= 1,
        detail: `${manual.freeElective} / 1 cr`,
      },
    ],
    matchedCourses: [],
  };

  // --- 9. NAMED OPTIONS ---
  let namedOptionSection: AuditSection | undefined;
  if (selectedOption === "ml_ds") {
    const mlMathPool = ["MATH 320", "MATH 340", "MATH 341", "MATH 375"];
    const mlMathDone = mlMathPool.find((id) => completedIds.has(id));
    const mlMathPlan = mlMathPool.find((id) => plannedIds.has(id));
    const mlElectives = courses.filter((c) => c.namedOptions.mlDs === "elective");
    const mlElecDone = mlElectives.find((c) => completedIds.has(c.id));
    const mlElecPlan = mlElectives.find((c) => plannedIds.has(c.id));
    const mlRules: AuditRuleCheck[] = [
      {
        id: "ml-331",
        label: "E C E 331 (Intro to Random Signal Analysis & Statistics, 3 cr)",
        satisfied: completedIds.has("E C E 331"),
        inProgressSatisfied: plannedIds.has("E C E 331"),
        detail: completedIds.has("E C E 331") ? "Completed" : plannedIds.has("E C E 331") ? "In Progress" : "Needed",
      },
      {
        id: "ml-linalg",
        label: "Linear Algebra (MATH 320, 340, or 341)",
        satisfied: Boolean(mlMathDone),
        inProgressSatisfied: Boolean(mlMathPlan),
        detail: mlMathDone || (mlMathPlan ? `${mlMathPlan} (In Progress)` : "Needed"),
      },
      {
        id: "ml-532",
        label: "E C E 532 (Matrix Methods in Machine Learning, 3 cr)",
        satisfied: completedIds.has("E C E 532"),
        inProgressSatisfied: plannedIds.has("E C E 532"),
        detail: completedIds.has("E C E 532") ? "Completed" : plannedIds.has("E C E 532") ? "In Progress" : "Needed",
      },
      {
        id: "ml-524",
        label: "E C E 524 (Introduction to Optimization, 3 cr)",
        satisfied: completedIds.has("E C E 524"),
        inProgressSatisfied: plannedIds.has("E C E 524"),
        detail: completedIds.has("E C E 524") ? "Completed" : plannedIds.has("E C E 524") ? "In Progress" : "Needed",
      },
      {
        id: "ml-elec",
        label: "1 Machine Learning & Data Science Elective (3–4 cr)",
        satisfied: Boolean(mlElecDone),
        inProgressSatisfied: Boolean(mlElecPlan),
        detail: mlElecDone ? mlElecDone.id : mlElecPlan ? `${mlElecPlan.id} (In Progress)` : "Needed",
      },
    ];
    namedOptionSection = {
      id: "named_ml_ds",
      title: "Named Option: Machine Learning & Data Science",
      requiredCredits: 15,
      completedCredits: mlRules.filter((r) => r.satisfied).length * 3,
      inProgressCredits: mlRules.filter((r) => !r.satisfied && r.inProgressSatisfied).length * 3,
      satisfied: mlRules.every((r) => r.satisfied),
      inProgressSatisfied: mlRules.every((r) => r.inProgressSatisfied),
      summary: `${mlRules.filter((r) => r.satisfied).length} / 5 requirements met`,
      rules: mlRules,
      matchedCourses: ["E C E 331", mlMathPlan, "E C E 532", "E C E 524", mlElecPlan?.id].filter(
        (x): x is string => Boolean(x && plannedIds.has(x))
      ),
    };
  } else if (selectedOption === "semiconductor") {
    const semiReq = ["E C E 305", "E C E 335", "E C E 548", "E C E 549"];
    const semiElectives = courses.filter((c) => c.namedOptions.semiconductor === "elective");
    const semiElecDone = semiElectives.filter((c) => completedIds.has(c.id));
    const semiElecPlan = semiElectives.filter((c) => plannedIds.has(c.id));
    const semiRules: AuditRuleCheck[] = [
      ...semiReq.map((id) => ({
        id: `semi-${id}`,
        label: `${id} — ${byId.get(id)?.title || ""} (${cr(id)} cr)`,
        satisfied: completedIds.has(id),
        inProgressSatisfied: plannedIds.has(id),
        detail: completedIds.has(id) ? "Completed" : plannedIds.has(id) ? "In Progress" : "Needed",
      })),
      {
        id: "semi-elec3",
        label: "Complete 3 Semiconductor Engineering Electives (9 cr)",
        satisfied: semiElecDone.length >= 3,
        inProgressSatisfied: semiElecPlan.length >= 3,
        detail: `${semiElecDone.length} / 3 completed`,
      },
    ];
    namedOptionSection = {
      id: "named_semiconductor",
      title: "Named Option: Semiconductor Engineering",
      requiredCredits: 20,
      completedCredits:
        sumCredits(semiReq, completedIds) +
        semiElecDone.slice(0, 3).reduce((s, c) => s + c.credits, 0),
      inProgressCredits: 0,
      satisfied: semiRules.every((r) => r.satisfied),
      inProgressSatisfied: semiRules.every((r) => r.inProgressSatisfied),
      summary: `${semiRules.filter((r) => r.satisfied).length} / 5 requirements met`,
      rules: semiRules,
      matchedCourses: [
        ...semiReq.filter((id) => plannedIds.has(id)),
        ...semiElecPlan.map((c) => c.id),
      ],
    };
  }

  const sections = [
    mathSection,
    scienceSection,
    coreSection,
    advSection,
    profSection,
    commSection,
    libSection,
    freeSection,
  ];

  // Note: total credits count unique completed courses + manual buckets
  const courseDoneCredits = courses
    .filter((c) => completedIds.has(c.id))
    .reduce((s, c) => s + c.credits, 0);
  const courseInProgCredits = courses
    .filter((c) => inProgressIds.has(c.id) && !completedIds.has(c.id))
    .reduce((s, c) => s + c.credits, 0);
  const manualTotal =
    manual.liberalStudies +
    manual.freeElective +
    manual.additionalProfElective +
    manual.additionalAdvElective;

  const totalCompletedCredits = courseDoneCredits + manualTotal;
  const totalInProgressCredits = courseInProgCredits;
  const totalPlannedCredits = totalCompletedCredits + totalInProgressCredits;

  const overallSatisfied =
    totalCompletedCredits >= 120 &&
    sections.every((s) => s.satisfied) &&
    (!namedOptionSection || namedOptionSection.satisfied);

  return {
    totalCompletedCredits,
    totalInProgressCredits,
    totalPlannedCredits,
    requiredTotalCredits: 120,
    sections,
    namedOptionSection,
    warnings,
    overallSatisfied,
  };
}
