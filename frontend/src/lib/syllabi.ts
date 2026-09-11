import type { SubjectData, Term } from "../types";

export interface SyllabusDocument {
    id: string;
    title: string;
    department: string;
    sourceFormat: "PDF" | "DOCX";
    previewUrl: string;
    downloadUrl: string;
}

type SyllabusRule = {
    subject: string;
    documents: string[];
};

const SYLLABUS_TERM: Term = { year: 2026, semester: 1 };

const syllabusAssets = import.meta.glob<string>(
    "../assets/syllabi/**/*.{pdf,docx}",
    { eager: true, query: "?url", import: "default" },
);

const normalize = (value: string): string =>
    value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "");

// Specific variants (EC, numbered courses) precede their broader counterparts.
const SYLLABUS_RULES: SyllabusRule[] = [
    { subject: "generalphysics2ec", documents: ["generalphysics2ec"] },
    { subject: "generalphysics2", documents: ["일반물리학2generalphysics2docx"] },
    { subject: "generalphysics1ec", documents: ["syllabusgenphys1261rev"] },
    { subject: "generalphysics1", documents: ["syllabusgenphys1261rev"] },
    { subject: "generalphysicslab1", documents: ["일물실험1generalphysicslab1"] },
    { subject: "generalphysicslab2", documents: ["일물실험2generalphysicslab2"] },
    { subject: "physicsandexp2", documents: ["physicsandexperiment2", "물리학및실험2"] },
    { subject: "physicsexp1", documents: ["물리학및실험1physicsexperiment1"] },
    { subject: "physicsseminar", documents: ["물리학세미나physicsseminar"] },
    { subject: "elementaryphysics", documents: ["basicphysics2syllabus"] },
    { subject: "projectphysics", documents: ["탐구물리20261강의계획서projectphysics"] },

    { subject: "generalbiology1ec", documents: ["generalbiology1syllabus"] },
    { subject: "generalbiology2ec", documents: ["fallgeneralbiology2"] },
    { subject: "generalbiologylab", documents: ["일반생물학실험generalbiologylab"] },
    { subject: "biologyexp", documents: ["생물학및실험강의계획서", "biologyexperimentii"] },
    { subject: "exploringintolifescienceec", documents: ["생물학의활용useoflifescience"] },
    { subject: "forensicscience", documents: ["forensicscience260222final"] },

    { subject: "generalchemistry2ec", documents: ["generalchemistry2"] },
    { subject: "generalchemistry1ec", documents: ["generalchemistry1docx"] },
    { subject: "generalchemistry1", documents: ["generalchemistry1docx"] },
    { subject: "generalchemistrylab1ec", documents: ["generalchemistrylaboratory1"] },
    { subject: "generalchemistrylab1", documents: ["generalchemistrylaboratory1"] },
    { subject: "fundamentalsofanalyticalchemistryec", documents: ["fundamentalsofanalyticalchemistry"] },
    { subject: "fundamentalsoforganicchemistry", documents: ["fundamentalsoforganicchemistry"] },
    { subject: "electrochemicalenergysystemec", documents: ["electrochemicalenergysystem"] },
    { subject: "chemistryexp", documents: ["화학및실험강의계획서", "chemistryandexperiment2"] },
    { subject: "specialtopicsinchemistrysensorchemistry", documents: ["specialtopicsinchemistrysensorchemistry"] },

    { subject: "elementarynumbertheoryec", documents: ["elementarynumbertheoryec"] },
    { subject: "linearalgebraec", documents: ["linearalgebraecsyllabus"] },
    { subject: "differentialequationsec", documents: ["differentialequationsdocx"] },
    { subject: "calculus2ec", documents: ["calulus2syllabus"] },
    { subject: "calculus3ec", documents: ["calculus3syllabus"] },
    { subject: "calculus3", documents: ["calculus3syllabus"] },
    { subject: "calculus1", documents: ["calculus1syllabusall"] },
    { subject: "mathematics1", documents: ["수학1mathematics1"] },
    { subject: "mathematics2", documents: ["수학2mathematics2"] },
    { subject: "mathematics3", documents: ["수학3mathematics3"] },
    { subject: "mathematicsseminar", documents: ["수학세미나mathematicsseminar"] },
    { subject: "applicationofmathematics", documents: ["applicationsofmathematicsforeignstudents", "수학의활용koreanstudents"] },
    { subject: "mathematicalmodeling", documents: ["수학적모델링mathematicalmodeling"] },
    { subject: "arthematics", documents: ["수학과예술arthematics"] },
    { subject: "probabilityandstatisticsec", documents: ["확률및통계probabilityandstatistics"] },
    { subject: "probabilityandstatistics", documents: ["확률및통계probabilityandstatistics"] },
    { subject: "programmingandproblemsolvingec", documents: ["프로그래밍과문제해결programmingandproblemsolving"] },
    { subject: "datastructures", documents: ["자료구조강의계획서20261datastructures"] },
    { subject: "algorithms", documents: ["강의계획서알고리즘algorithms"] },

    { subject: "generalearthsciencelab", documents: ["generalearthsciencelab20261"] },
    { subject: "generalearthscience", documents: ["강의계획서20261generalearthscience"] },
    { subject: "generalastronomylab", documents: ["generalastronomylab"] },
    { subject: "generalastronomy", documents: ["syllabusgeneralastronomy"] },

    { subject: "historyandphilosophyofscience", documents: ["과학의역사와철학20261", "understandinghistoryandphilosophyofscience"] },
    { subject: "specialtopicsinconvergencehistoryandphilosophyofphysics", documents: ["융합특강물리학의역사와철학20261"] },
    { subject: "astrobiology", documents: ["astrobiology"] },

    { subject: "englishforacademicpurposes", documents: ["20261eapsyllabus"] },
    { subject: "criticalthinkinganddiscussion", documents: ["20261ctdsyllabus"] },
    { subject: "interculturalliteracy", documents: ["26globalculture"] },
    { subject: "newsandmedia", documents: ["newsmediaenglishspring2026"] },
    { subject: "spanishlanguageculture", documents: ["스페인언어와문화spanishlanguageculture"] },
    { subject: "japaneselanguageculture", documents: ["일본어japaneselanguageculture"] },
    { subject: "chineselanguageculture", documents: ["중국언어와문화chineselanguageculture"] },

    { subject: "logicalwriting", documents: ["논리와글쓰기"] },
    { subject: "wordsandsentences", documents: ["단어와문장"] },
    { subject: "literatureandsociety", documents: ["문학과사회"] },
    { subject: "literature", documents: ["문학강의계획서"] },
    { subject: "communicationandspeech", documents: ["소통과화법"] },

    { subject: "understandingofworldhistory", documents: ["세계사의이해강의계획서"] },
    { subject: "politicsandeconomics", documents: ["정치와경제"] },
    { subject: "understandingofkoreanhistory", documents: ["한국사의이해2026학년도1학기"] },
    { subject: "koreanmodernhistory", documents: ["koreanhistoryfall2025"] },
    { subject: "philosophy", documents: ["20261철학강의계획서"] },

    { subject: "finearts", documents: ["강의계획서미술20261박주영arts"] },
    { subject: "artsinlife", documents: ["생활미술공예와디자인202601박주영artsinlifecraftanddesign"] },
    { subject: "musicinlife", documents: ["생활음악합창musicinlifechoir", "재즈의역사jazzhistory"] },
    { subject: "physicaleducationinlife1", documents: ["생활체육1구기ballsports", "생활체육1라켓스포츠racketsports"] },
    { subject: "music", documents: ["강의계획서음악music"] },
];

const originalAssetEntries = Object.entries(syllabusAssets).filter(
    ([path]) => !path.toLowerCase().endsWith(".preview.pdf"),
);

const getTitle = (path: string): string => {
    const filename = path.split("/").pop() ?? path;
    return filename.replace(/\.(pdf|docx)$/i, "").replaceAll("_", " ");
};

const getDepartment = (path: string): string => {
    const relative = path.split("/syllabi/")[1] ?? path;
    const parts = relative.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "Syllabus";
};

export const findSyllabiForSubject = (
    subject: Pick<SubjectData, "subject" | "subject_english" | "is_ec">,
    term: Term | null,
): SyllabusDocument[] => {
    if (
        term?.year !== SYLLABUS_TERM.year ||
        term.semester !== SYLLABUS_TERM.semester
    ) {
        return [];
    }

    const normalizedSubject = normalize(
        [subject.subject, subject.subject_english, subject.is_ec ? "EC" : ""]
            .filter(Boolean)
            .join(" "),
    );
    const rule = SYLLABUS_RULES.find(({ subject: hint }) =>
        normalizedSubject.includes(hint),
    );

    if (!rule) return [];

    const matches = originalAssetEntries
        .filter(([path]) => {
            const normalizedPath = normalize(path);
            return rule.documents.some((hint) => normalizedPath.includes(hint));
        })
        .map(([path, downloadUrl]) => {
            const isDocx = path.toLowerCase().endsWith(".docx");
            const previewPath = isDocx
                ? path.replace(/\.docx$/i, ".preview.pdf")
                : path;

            return {
                id: path,
                title: getTitle(path),
                department: getDepartment(path),
                sourceFormat: isDocx ? "DOCX" as const : "PDF" as const,
                previewUrl: syllabusAssets[previewPath] ?? downloadUrl,
                downloadUrl,
            };
        });

    // The archive contains the same Forensic Science document in two folders.
    return matches.filter(
        (document, index, all) =>
            all.findIndex((candidate) => candidate.title === document.title) === index,
    );
};
