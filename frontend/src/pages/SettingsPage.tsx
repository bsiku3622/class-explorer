import React, { useState } from "react";
import { Info, BookOpen, Search, Map, Library, Database, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RetroCard from "../components/atoms/RetroCard";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import AccordionSection from "../components/molecules/AccordionSection";
import PageHeader from "../components/molecules/PageHeader";

interface GuideSection {
    title: string;
    icon: LucideIcon;
    content: React.ReactNode;
}

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <code className="bg-black text-white px-1.5 py-0.5 text-xs font-black">{children}</code>
);

const Row: React.FC<{ label: React.ReactNode; desc: React.ReactNode }> = ({ label, desc }) => (
    <div className="flex gap-4 items-center">
        <div className="shrink-0 min-w-[90px]">{label}</div>
        <p className="text-sm font-bold text-black/60 leading-relaxed">{desc}</p>
    </div>
);

const guideSections: GuideSection[] = [
    {
        title: "Search — 기본 검색",
        icon: Search,
        content: (
            <div className="space-y-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                    검색창에 키워드를 입력하면 과목, 학생, 교사, 강의실을 동시에 탐색합니다.
                </p>
                <div className="space-y-3">
                    <Row label={<Code>이름</Code>} desc="학생 이름 또는 교사 이름으로 검색" />
                    <Row label={<Code>학번</Code>} desc="학번(예: 25-001)으로 특정 학생 검색" />
                    <Row label={<Code>과목명</Code>} desc="과목 이름 또는 일부로 검색 (한글/영문 모두 가능)" />
                    <Row label={<Code>강의실</Code>} desc="강의실명(예: 형3202)으로 검색" />
                    <Row label={<Code>월1</Code>} desc="요일+교시(월1, 화3, 수5 등)로 해당 시간 수업 검색" />
                    <Row label={<Code>ㅈㄱ</Code>} desc="초성만 입력하면 초성 검색 (예: ㅈㄱ → 자구, ㅍㅁㅎ → 프문해)" />
                </div>
            </div>
        ),
    },
    {
        title: "Search — Prefix 검색",
        icon: Zap,
        content: (
            <div className="space-y-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                    prefix를 붙이면 특정 유형으로만 검색을 한정하고, 시간표 뷰로 바로 확인할 수 있습니다.
                </p>
                <div className="space-y-3">
                    <Row label={<Code>student:학번</Code>} desc="특정 학생의 전체 시간표와 수강 과목 표시" />
                    <Row label={<Code>teacher:이름</Code>} desc="특정 교사의 담당 수업 전체 표시" />
                    <Row label={<Code>room:강의실</Code>} desc="특정 강의실에서 열리는 수업 전체 표시" />
                </div>
                <div className="border-2 border-black/10 p-3 bg-black/5 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">예시</p>
                    <p className="text-xs font-bold text-black/60"><Code>student:25-001</Code> — 25학번 001번 학생 시간표</p>
                    <p className="text-xs font-bold text-black/60"><Code>teacher:홍길동</Code> — 홍길동 선생님 수업 목록</p>
                    <p className="text-xs font-bold text-black/60"><Code>room:형3202</Code> — 형설관 3층 202호 수업 목록</p>
                </div>
            </div>
        ),
    },
    {
        title: "Search — 논리 연산자",
        icon: Zap,
        content: (
            <div className="space-y-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                    여러 조건을 조합해 복잡한 검색을 할 수 있습니다.
                </p>
                <div className="space-y-3">
                    <Row label={<Code>&</Code>} desc="AND — 두 조건 모두 만족하는 수업 (예: 수학 & 홍길동)" />
                    <Row label={<Code>+</Code>} desc="OR — 둘 중 하나라도 만족하는 수업 (예: 수학 + 영어)" />
                    <Row label={<Code>!</Code>} desc="NOT — 해당 조건을 제외 (예: 수학 & !홍길동)" />
                    <Row label={<Code>( )</Code>} desc="그룹 — 연산 우선순위 지정 (예: (수학 + 영어) & 형3202)" />
                </div>
                <div className="border-2 border-black/10 p-3 bg-black/5 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">예시</p>
                    <p className="text-xs font-bold text-black/60"><Code>student:25-001 & student:25-002</Code> — 두 학생이 함께 듣는 수업</p>
                    <p className="text-xs font-bold text-black/60"><Code>수학 + 영어</Code> — 수학 또는 영어 수업 모두 보기</p>
                </div>
            </div>
        ),
    },
    {
        title: "Browse — 학생 / 교사 탐색",
        icon: Library,
        content: (
            <div className="space-y-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                    Browse 탭에서 전체 학생 또는 교사 목록을 탐색할 수 있습니다.
                </p>
                <div className="space-y-3">
                    <Row
                        label={<span className="text-xs font-black uppercase bg-black text-white px-1.5 py-0.5">Students</span>}
                        desc="학번·이름으로 검색, 학년별 필터 지원. 카드 클릭 시 해당 학생 시간표 검색"
                    />
                    <Row
                        label={<span className="text-xs font-black uppercase bg-black text-white px-1.5 py-0.5">Teachers</span>}
                        desc="교사명으로 검색. 카드 클릭 시 해당 교사 담당 수업 검색"
                    />
                </div>
                <div className="border-2 border-black/10 p-3 bg-black/5 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">특수 검색 (Students 전용)</p>
                    <p className="text-xs font-bold text-black/60"><Code>periods:11</Code> — 주 11교시 수강 학생만</p>
                    <p className="text-xs font-bold text-black/60"><Code>subcount:5</Code> — 5과목 수강 학생만</p>
                </div>
            </div>
        ),
    },
    {
        title: "Rooms — 빈 강의실 탐색",
        icon: Map,
        content: (
            <div className="space-y-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                    특정 요일·교시에 비어있는 강의실을 탐색합니다.
                </p>
                <div className="space-y-3">
                    <Row label={<span className="text-xs font-black">요일 선택</span>} desc="월~금 중 원하는 요일 선택" />
                    <Row label={<span className="text-xs font-black">교시 선택</span>} desc="1~11교시 중 원하는 교시 선택" />
                    <Row label={<span className="text-xs font-black">강의실 버튼</span>} desc="비어있는 강의실은 활성화, 수업이 있는 강의실은 비활성화 표시" />
                </div>
            </div>
        ),
    },
];

const SettingsPage: React.FC = () => {
    const [openGuide, setOpenGuide] = useState<number | null>(0);

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="About" subtitle="App" icon={Info} />

            {/* Guide Book */}
            <RetroCard className="bg-white p-6">
                <div className="space-y-4">
                    <RetroSubTitle title="Guide Book" icon={BookOpen} />
                    <p className="text-xs font-bold text-black/40">
                        각 기능의 사용법을 확인하세요.
                    </p>
                    <div className="space-y-2">
                        {guideSections.map((section, i) => (
                            <AccordionSection
                                key={i}
                                title={section.title}
                                icon={section.icon}
                                isOpen={openGuide === i}
                                onToggle={() => setOpenGuide(openGuide === i ? null : i)}
                            >
                                {section.content}
                            </AccordionSection>
                        ))}
                    </div>
                </div>
            </RetroCard>

            {/* About */}
            <RetroCard className="bg-white p-6">
                <div className="space-y-3">
                    <RetroSubTitle title="About" icon={Database} />
                    <div className="space-y-1.5 text-xs font-bold text-black/50">
                        <p>KSA Class Explorer — 한국과학영재학교 수업 탐색 서비스</p>
                        <p>데이터 출처: KSAIN API</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 border-2 border-black px-2 py-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Version</span>
                        <span className="text-xs font-black">v{__APP_VERSION__}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-1">beta</span>
                    </div>
                </div>
            </RetroCard>
        </div>
    );
};

export default SettingsPage;
