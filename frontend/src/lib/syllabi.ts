/**
 * 2026-1 강의계획서 — 과목과 파일을 짝짓고, 로그인한 채로 받아 옵니다.
 *
 * ⚠️ **파일은 화면 번들에 없습니다.** 한때 `assets/syllabi/` 를 `import.meta.glob` 으로 번들에 실었더니
 * Netlify 가 로그인 없이 내줬고, 대부분에 교사 이메일·전화번호가 들어 있었습니다. 지금은 서버가 로그인한
 * 사람에게만 줍니다(`GET /syllabi` 목록 · `GET /syllabi/{id}` 파일 — `backend/services/syllabi.py`). 그래서
 * 미리보기·내려받기는 인증 헤더를 붙여 **Blob 으로** 받습니다 — iframe 과 `<a href>` 는 헤더를 못 보냅니다.
 *
 * 짝짓기는 예전과 같습니다 — 서버 목록의 경로(학부/학과/파일 이름)를 `SYLLABUS_RULES` 로 봅니다.
 */
import type { SubjectData, Term } from "../types";
import api from "./api";
import { cached, HOUR } from "./cache";
import { authHeader } from "./session";

/** 서버 목록의 한 줄 — `path` 는 `syllabi/` 기준 상대 경로입니다 */
export interface SyllabusFile {
    id: string;
    path: string;
    format: "pdf" | "docx";
}

export interface SyllabusDocument {
    /** 원본 파일의 id — 내려받기 */
    id: string;
    /** PDF 미리보기의 id — docx 면 같은 자리의 `.preview.pdf`, 없으면 원본 */
    previewId: string;
    title: string;
    /** 내려받을 때의 파일 이름 */
    filename: string;
    department: string;
    sourceFormat: "PDF" | "DOCX";
}

type SyllabusRule = {
    subject: string;
    documents: string[];
};

const SYLLABUS_TERM: Term = { year: 2026, semester: 1 };

/** 강의계획서가 있는 학기인가 — 아니면 목록을 받지도 않습니다 */
export const hasSyllabusTerm = (term: Term | null): boolean =>
    term?.year === SYLLABUS_TERM.year && term.semester === SYLLABUS_TERM.semester;

/**
 * 서버의 파일 목록. 한 시간 캐시해 과목 아코디언마다 다시 받지 않습니다 — 로그아웃 때 `clearCache` 가
 * 같이 지웁니다(파일 이름에 교사 이름이 든 것이 있습니다).
 */
export const fetchSyllabusFiles = (): Promise<SyllabusFile[]> =>
    cached("syllabi", HOUR, async () => {
        const { data } = await api.get<SyllabusFile[]>("/syllabi", { headers: authHeader() });
        return data;
    });

export const getSyllabusBlob = async (id: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`/syllabi/${id}`, {
        headers: authHeader(),
        responseType: "blob",
    });
    return data;
};

/** 원본을 받아 저장 창을 띄웁니다. Blob URL 은 바로 거둡니다 */
export const downloadSyllabus = async (doc: SyllabusDocument): Promise<void> => {
    const url = URL.createObjectURL(await getSyllabusBlob(doc.id));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = doc.filename;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

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

const getFilename = (path: string): string => path.split("/").pop() ?? path;

const getTitle = (path: string): string =>
    getFilename(path).replace(/\.(pdf|docx)$/i, "").replaceAll("_", " ");

const getDepartment = (path: string): string => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "Syllabus";
};

/** 이 과목의 짝짓기 규칙 — 강의계획서가 없는 학기·과목이면 `undefined` */
export const syllabusRuleFor = (
    subject: Pick<SubjectData, "subject" | "subject_english" | "is_ec">,
    term: Term | null,
): SyllabusRule | undefined => {
    if (!hasSyllabusTerm(term)) return undefined;
    const normalizedSubject = normalize(
        [subject.subject, subject.subject_english, subject.is_ec ? "EC" : ""]
            .filter(Boolean)
            .join(" "),
    );
    return SYLLABUS_RULES.find(({ subject: hint }) =>
        normalizedSubject.includes(hint),
    );
};

export const findSyllabiForSubject = (
    subject: Pick<SubjectData, "subject" | "subject_english" | "is_ec">,
    term: Term | null,
    files: SyllabusFile[],
): SyllabusDocument[] => {
    const rule = syllabusRuleFor(subject, term);
    if (!rule) return [];

    const byPath = new Map(files.map((file) => [file.path, file]));
    const matches = files
        .filter((file) => !file.path.toLowerCase().endsWith(".preview.pdf"))
        .filter((file) => {
            const normalizedPath = normalize(file.path);
            return rule.documents.some((hint) => normalizedPath.includes(hint));
        })
        .map((file) => {
            const isDocx = file.format === "docx";
            const preview = isDocx
                ? byPath.get(file.path.replace(/\.docx$/i, ".preview.pdf"))
                : undefined;

            return {
                id: file.id,
                previewId: preview?.id ?? file.id,
                title: getTitle(file.path),
                filename: getFilename(file.path),
                department: getDepartment(file.path),
                sourceFormat: isDocx ? "DOCX" as const : "PDF" as const,
            };
        });

    // The archive contains the same Forensic Science document in two folders.
    return matches.filter(
        (document, index, all) =>
            all.findIndex((candidate) => candidate.title === document.title) === index,
    );
};
