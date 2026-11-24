export type AreaId =
  | 'lab'
  | 'fields_waves'
  | 'systems_control'
  | 'power_machines'
  | 'comm_sp'
  | 'circuits_devices'
  | 'computers_computing';

export type PrimaryCategory =
  | 'math'
  | 'science'
  | 'core'
  | 'adv_elective'
  | 'prof_elective'
  | 'comm'
  | 'named_option_extra'
  | 'external_prereq';

export type NamedOptionId = 'standard' | 'ml_ds' | 'semiconductor';

export type CourseStatus = 'not_taken' | 'in_progress' | 'completed';

export type AvailabilityStatus = 'completed' | 'in_progress' | 'available' | 'locked';

export type PrereqNode =
  | {
      type: 'course';
      code: string;
      concurrent?: boolean;
    }
  | {
      type: 'and';
      items: PrereqNode[];
    }
  | {
      type: 'or';
      items: PrereqNode[];
    };

export interface CourseEdge {
  id: string;
  source: string;
  target: string;
  relation: 'prereq' | 'coreq_or_prereq';
  logic: 'required' | 'alternative';
  groupLabel?: string;
}

export interface Course {
  id: string; // Canonical code, e.g. "E C E 252"
  displayCode: string; // e.g. "E C E/COMP SCI 252"
  aliases: string[]; // e.g. ["COMP SCI 252"]
  title: string;
  credits: number;
  creditsLabel: string; // e.g. "3" or "1-3"
  description: string;
  requisitesRaw: string;
  prereqAst: PrereqNode | null;
  nonCourseReqs: string[];
  waivers: string[];
  exclusionsRaw: string;
  exclusions: string[];
  learningOutcomes: string[];
  designations: string[];
  lastTaught: string;
  repeatable: string;

  primaryCategory: PrimaryCategory;
  categories: string[];
  areas: AreaId[];
  isCore: boolean;
  isCapstone: boolean;
  isLab: boolean;
  is301to317Lab: boolean;
  is400PlusEce: boolean;
  isAdvMathAux: boolean;
  isProbStat: boolean;
  isExternalPrereq: boolean;
  namedOptions: {
    mlDs?: 'required' | 'elective';
    semiconductor?: 'required' | 'elective';
  };
  sampleSemesters: number[]; // 1..8 from 4-year sample plan
}

export interface SamplePlanItem {
  label: string;
  courseId?: string;
  altCourseIds?: string[];
  credits: string;
  isElectivePlaceholder?: boolean;
  note?: string;
}

export interface SampleSemester {
  semester: number; // 1..8
  year: number; // 1..4
  term: 'Fall' | 'Spring';
  totalCredits: number;
  items: SamplePlanItem[];
}

export interface ManualCredits {
  liberalStudies: number;
  freeElective: number;
  additionalProfElective: number;
  additionalAdvElective: number;
  placedOutCommA: boolean;
  placedOutQrA: boolean;
  genEdHumanities6: boolean;
  genEdSocialSci3: boolean;
  genEdEthnicStudies3: boolean;
  genEdCivics3: boolean;
  genEdNatSciLab: boolean;
  residency30: boolean;
  languageReq: boolean;
}

export interface AuditRuleCheck {
  id: string;
  label: string;
  satisfied: boolean;
  inProgressSatisfied?: boolean;
  detail: string;
}

export interface AuditSection {
  id: string;
  title: string;
  requiredCredits: number;
  completedCredits: number;
  inProgressCredits: number;
  satisfied: boolean;
  inProgressSatisfied: boolean;
  summary: string;
  rules: AuditRuleCheck[];
  matchedCourses: string[];
}

export interface DegreeAuditReport {
  totalCompletedCredits: number;
  totalInProgressCredits: number;
  totalPlannedCredits: number;
  requiredTotalCredits: number;
  sections: AuditSection[];
  namedOptionSection?: AuditSection;
  warnings: string[];
  overallSatisfied: boolean;
}

export interface CurriculumDataset {
  generatedAt: string;
  catalogYear: string;
  sourceUrl: string;
  courses: Course[];
  edges: CourseEdge[];
  aliasMap: Record<string, string>;
  samplePlan: SampleSemester[];
  stats: {
    totalCourses: number;
    curriculumCourses: number;
    externalPrereqs: number;
    totalEdges: number;
  };
}
