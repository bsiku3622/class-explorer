import React, { useState } from "react";
import { Info, BookOpen, Search, Map, Library, Database, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DeviceSessions from "../components/DeviceSessions";
import MajorSettings from "../components/MajorSettings";
import type { MyMajor } from "../lib/majors";
import { Accordion, Badge, Card, Code, PageHeader, SectionTitle, Surface, Text } from "@studio-baeks/funky-ui";

interface GuideSection {
    title: string;
    icon: LucideIcon;
    content: React.ReactNode;
}

const Row: React.FC<{ label: React.ReactNode; desc: React.ReactNode }> = ({ label, desc }) => (
    <div className="flex gap-4 items-center">
        <div className="shrink-0 min-w-[90px]">{label}</div>
        <Text as="p" tone="secondary" leading="relaxed">
            {desc}
        </Text>
    </div>
);

const guideSections: GuideSection[] = [
    {
        title: "Search — 기본 검색",
        icon: Search,
        content: (
            <div className="space-y-4">
                <Text as="p" tone="secondary" leading="relaxed">
                    검색창에 키워드를 입력하면 과목, 학생, 교사, 강의실을 동시에 탐색합니다.
                </Text>
                <div className="space-y-3">
                    <Row label={<Code>이름</Code>} desc="학생 이름 또는 교사 이름으로 검색" />
                    <Row label={<Code>학번</Code>} desc="학번(예: 25-001)으로 특정 학생 검색" />
                    <Row label={<Code>과목명</Code>} desc="과목 이름 또는 일부로 검색 (한글/영문 모두 가능)" />
                    <Row label={<Code>강의실</Code>} desc="강의실명(예: 형3202)으로 검색" />
                    <Row label={<Code>월1</Code>} desc="요일+교시(월1, 화3, 수5 등)로 해당 시간 수업 검색" />
                    <Row label={<Code>ㅈㄱ</Code>} desc="초성만 입력하면 초성 검색 (예: ㅈㄱ → 자구, ㅍㅁㅎ → 프문해)" />
                    <Row label={<Code>정3</Code>} desc="줄여 써도 찾아줍니다 (예: 정3 → 정보과학3, 일물실1 → 일반물리학실험1)" />
                    <Row label={<Code>체육4/5</Code>} desc="과목/분반으로 특정 분반만 검색. 여러 개는 콤마로 (예: 체육4/2,3)" />
                </div>
            </div>
        ),
    },
    {
        title: "Search — Prefix 검색",
        icon: Zap,
        content: (
            <div className="space-y-4">
                <Text as="p" tone="secondary" leading="relaxed">
                    prefix를 붙이면 특정 유형으로만 검색을 한정하고, 시간표 뷰로 바로 확인할 수 있습니다.
                </Text>
                <div className="space-y-3">
                    <Row label={<Code>student:학번</Code>} desc="특정 학생의 전체 시간표와 수강 과목 표시" />
                    <Row label={<Code>teacher:이름</Code>} desc="특정 교사의 담당 수업 전체 표시" />
                    <Row label={<Code>room:강의실</Code>} desc="특정 강의실에서 열리는 수업 전체 표시" />
                </div>
                <Surface fill="well" border="subtle" padding="lg" className="space-y-1">
                    <Text as="p" variant="overline">예시</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>student:25-001</Code> — 25학번 001번 학생 시간표</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>teacher:홍길동</Code> — 홍길동 선생님 수업 목록</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>room:형3202</Code> — 형설관 3층 202호 수업 목록</Text>
                </Surface>
            </div>
        ),
    },
    {
        title: "Search — 논리 연산자",
        icon: Zap,
        content: (
            <div className="space-y-4">
                <Text as="p" tone="secondary" leading="relaxed">
                    여러 조건을 조합해 복잡한 검색을 할 수 있습니다.
                </Text>
                <div className="space-y-3">
                    <Row label={<Code>&</Code>} desc="AND — 두 조건 모두 만족하는 수업 (예: 수학 & 홍길동)" />
                    <Row label={<Code>+</Code>} desc="OR — 둘 중 하나라도 만족하는 수업 (예: 수학 + 영어)" />
                    <Row label={<Code>!</Code>} desc="NOT — 해당 조건을 제외 (예: 수학 & !홍길동)" />
                    <Row label={<Code>( )</Code>} desc="그룹 — 연산 우선순위 지정 (예: (수학 + 영어) & 형3202)" />
                </div>
                <Surface fill="well" border="subtle" padding="lg" className="space-y-1">
                    <Text as="p" variant="overline">예시</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>student:25-001 & student:25-002</Code> — 두 학생이 함께 듣는 수업</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>수학 + 영어</Code> — 수학 또는 영어 수업 모두 보기</Text>
                </Surface>
            </div>
        ),
    },
    {
        title: "Browse — 학생 / 교사 탐색",
        icon: Library,
        content: (
            <div className="space-y-4">
                <Text as="p" tone="secondary" leading="relaxed">
                    Browse 탭에서 전체 학생 또는 교사 목록을 탐색할 수 있습니다.
                </Text>
                <div className="space-y-3">
                    <Row
                        label={<Badge variant="filled" size="sm">Students</Badge>}
                        desc="학번·이름으로 검색, 학년별 필터 지원. 카드 클릭 시 해당 학생 시간표 검색"
                    />
                    <Row
                        label={<Badge variant="filled" size="sm">Teachers</Badge>}
                        desc="교사명으로 검색. 카드 클릭 시 해당 교사 담당 수업 검색"
                    />
                </div>
                <Surface fill="well" border="subtle" padding="lg" className="space-y-1">
                    <Text as="p" variant="overline">특수 검색 (Students 전용)</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>periods:11</Code> — 주 11교시 수강 학생만</Text>
                    <Text as="p" variant="caption" tone="secondary"><Code>subcount:5</Code> — 5과목 수강 학생만</Text>
                </Surface>
            </div>
        ),
    },
    {
        title: "Rooms — 빈 강의실 탐색",
        icon: Map,
        content: (
            <div className="space-y-4">
                <Text as="p" tone="secondary" leading="relaxed">
                    특정 요일·교시에 비어있는 강의실을 탐색합니다.
                </Text>
                <div className="space-y-3">
                    <Row label={<Text variant="caption" weight="black">요일 선택</Text>} desc="월~금 중 원하는 요일 선택" />
                    <Row label={<Text variant="caption" weight="black">교시 선택</Text>} desc="1~11교시 중 원하는 교시 선택" />
                    <Row label={<Text variant="caption" weight="black">강의실 버튼</Text>} desc="비어있는 강의실은 활성화, 수업이 있는 강의실은 비활성화 표시" />
                </div>
            </div>
        ),
    },
];

interface SettingsPageProps {
    /** 전공을 바꿨을 때 — App 의 `currentUser` 를 맞춥니다 */
    onMajorSaved: (me: MyMajor) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onMajorSaved }) => {
    const [openGuide, setOpenGuide] = useState<number | null>(0);

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="About" subtitle="App" icon={Info} />

            {/* Guide Book */}
            <Card padding="0" className="p-6">
                <div className="space-y-4">
                    <SectionTitle title="Guide Book" icon={BookOpen} />
                    <Text as="p" variant="caption" tone="muted">
                        각 기능의 사용법을 확인하세요.
                    </Text>
                    <div className="space-y-2">
                        {guideSections.map((section, i) => (
                            <Accordion
                                key={i}
                                titleStyle="section"
                                title={section.title}
                                icon={section.icon}
                                open={openGuide === i}
                                onOpenChange={() => setOpenGuide(openGuide === i ? null : i)}
                            >
                                {section.content}
                            </Accordion>
                        ))}
                    </div>
                </div>
            </Card>

            {/* 전공과 로그인한 기기 — 가이드북 아래, About 위에 둡니다: 읽는 것(가이드)과 앱 정보
                사이에 있는 **뭔가를 하는 칸**이라 끝에 붙이면 못 찾습니다. 기기 칸은 다중 기기
                로그인을 열면서, 전공 칸은 전공을 묻는 창(`MajorPrompt`)과 같이 생겼습니다 */}
            <MajorSettings onSaved={onMajorSaved} />
            <DeviceSessions />

            {/* About */}
            <Card padding="0" className="p-6">
                <div className="space-y-3">
                    <SectionTitle title="About" icon={Database} />
                    <div className="space-y-1.5">
                        <Text as="p" variant="caption" tone="secondary">KSA Class Explorer — 한국과학영재학교 수업 탐색 서비스</Text>
                        <Text as="p" variant="caption" tone="secondary">데이터 출처: KEIS (수업) · KSAIN (급식)</Text>
                    </div>
                    <Surface fill="none" border="line" paddingX="md" className="inline-flex items-center gap-1.5 py-0.5">
                        <Text variant="overline">Version</Text>
                        <Text variant="caption" weight="black">v{__APP_VERSION__}</Text>
                        <Badge size="sm" variant="filled">beta</Badge>
                    </Surface>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;
