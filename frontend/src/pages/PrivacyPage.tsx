import React from "react";
import { ArrowLeft } from "lucide-react";
import RetroCard from "../components/atoms/RetroCard";

/**
 * 개인정보처리방침 — **로그인 없이 열리는 두 번째 화면**입니다.
 *
 * 담는 항목은 「개인정보 보호법」제30조 제1항 각 호와 같은 법 시행령 제31조가 정합니다.
 * 순서를 바꾸는 건 상관없지만 **항목을 빼면 안 됩니다.** 광고 쿠키 문단은 애드센스가
 * 게시자에게 요구하는 고지라, 광고를 내리면 그 문단도 같이 손봐야 합니다.
 *
 * ⚠️ **여기 적힌 것과 실제가 어긋나면 방침이 아니라 거짓말이 됩니다.** 수집 항목이나
 * 보관 기간을 바꾸는 코드를 건드렸으면 이 화면도 같이 고치세요.
 */

const UPDATED = "2026년 8월 23일";
const CONTACT = "contact@bsiku.dev";

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="mt-10 border-b-2 border-black pb-2 text-xl font-black tracking-tight md:text-2xl">
        {children}
    </h2>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="mt-4 text-[14px] font-medium leading-[1.85] text-black/75">
        {children}
    </p>
);

const Ul: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
    <ul className="mt-4 flex flex-col gap-2">
        {items.map((it, i) => (
            <li
                key={i}
                className="flex gap-2.5 text-[14px] font-medium leading-[1.8] text-black/75"
            >
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-black" />
                <span className="min-w-0">{it}</span>
            </li>
        ))}
    </ul>
);

/** 표는 좁은 화면에서 가로로 흘립니다 — 줄바꿈으로 뭉개면 어느 칸인지 못 읽습니다 */
const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({
    head,
    rows,
}) => (
    <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-2 border-black text-left text-[13px]">
            <thead>
                <tr className="bg-black text-white">
                    {head.map((h) => (
                        <th key={h} className="px-3 py-2 font-black">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr
                        key={i}
                        className="border-t-2 border-black/10 align-top [&>td:first-child]:whitespace-nowrap [&>td:first-child]:font-bold [&>td:first-child]:text-black"
                    >
                        {r.map((c, j) => (
                            <td
                                key={j}
                                className="px-3 py-2.5 font-medium leading-relaxed text-black/75"
                            >
                                {c}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const A: React.FC<{ href: string; children: React.ReactNode }> = ({
    href,
    children,
}) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="border-b-2 border-retro-secondary font-bold text-retro-secondary transition-colors duration-100 hover:bg-retro-secondary hover:text-white"
    >
        {children}
    </a>
);

interface PrivacyPageProps {
    /** 소개 화면으로 돌아갑니다 */
    onBack: () => void;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => (
    <div className="min-h-screen bg-retro-bg text-retro-fg">
        <header className="border-b-2 border-black bg-retro-secondary">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4 md:px-8">
                <span className="-skew-x-6 text-lg font-black uppercase tracking-tight text-white md:text-xl">
                    Class Explorer
                </span>
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 border-2 border-white/40 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white transition-colors duration-100 hover:border-white"
                >
                    <ArrowLeft size={13} strokeWidth={3} /> 돌아가기
                </button>
            </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8 md:py-16">
            <h1 className="-skew-x-6 text-3xl font-black uppercase tracking-tighter md:text-4xl">
                개인정보처리방침
            </h1>
            <p className="mt-4 text-[13px] font-bold text-black/40">
                시행일 {UPDATED}
            </p>

            <RetroCard shadow="sm" className="mt-8 bg-white p-5">
                <P>
                    Class Explorer(이하 &lsquo;서비스&rsquo;)는 한국과학영재학교 구성원이
                    수업 시간표를 찾아보는 웹 서비스입니다. 학교가 공식으로 운영하는
                    서비스가 아니라 <b>개인이 만들어 운영하는 서비스</b>이며, 이용자의
                    개인정보를 소중히 다루기 위해 「개인정보 보호법」에 따라 이 방침을
                    두고 공개합니다.
                </P>
            </RetroCard>

            <H2>1. 처리하는 개인정보 항목</H2>
            <P>
                서비스는 다음 항목을 처리합니다. 학교 학사 시스템에서 받아 오는 항목은
                이용자가 직접 입력하지 않으며, 출처는 아래 3항에 적었습니다.
            </P>
            <Table
                head={["구분", "항목", "수집 방법"]}
                rows={[
                    [
                        "계정",
                        "아이디, 비밀번호(단방향 암호화하여 저장), 권한 등급",
                        "관리자가 계정을 만들 때",
                    ],
                    [
                        "본인 확인",
                        "학교 구글 계정 주소, 학번",
                        "이용자가 학교 구글 계정으로 한 번 확인할 때",
                    ],
                    [
                        "접속 기록",
                        "접속 IP 주소, 브라우저·운영체제 이름, 마지막 사용 시각, 세션 식별자",
                        "로그인할 때 자동 생성",
                    ],
                    [
                        "학사 정보",
                        "이름, 학번, 수강 과목과 분반, 시간표, 담당 교사, 강의실",
                        "학교 학사 시스템에서 학기 단위로 수집",
                    ],
                    [
                        "이용자 입력",
                        "이수 기록(과목·학점·평어), 개인 일정, 친구 목록, 수강 변경 계획",
                        "이용자가 화면에서 직접 입력",
                    ],
                ]}
            />
            <P>
                신용카드 번호나 주민등록번호처럼 결제·고유식별정보에 해당하는 항목은
                수집하지 않습니다. 비밀번호는 원문을 저장하지 않아 운영자도 알 수 없습니다.
            </P>

            <H2>2. 개인정보의 처리 목적</H2>
            <Ul
                items={[
                    <>
                        <b>로그인과 본인 확인</b> — 계정을 식별하고, 그 계정이 어느 학번의
                        사람인지 확인합니다. 학번을 확인해야 이수 기록처럼 본인만의 정보를
                        다룰 수 있습니다.
                    </>,
                    <>
                        <b>시간표 조회</b> — 수업, 담당 교사, 강의실, 빈 강의실을 찾아
                        보여 줍니다.
                    </>,
                    <>
                        <b>개인 기록 보관</b> — 이수 기록, 개인 일정, 친구 목록, 수강 변경
                        계획을 계정에 저장해 어느 기기에서 접속하든 이어서 볼 수 있게
                        합니다.
                    </>,
                    <>
                        <b>접속 기기 관리</b> — 한 계정에 로그인해 둔 기기를 이용자가
                        직접 확인하고 끊을 수 있게 합니다. 계정 도용을 알아채는 수단이기도
                        합니다.
                    </>,
                ]}
            />

            <H2>3. 정보주체 이외로부터 수집한 개인정보의 출처</H2>
            <P>
                이름, 학번, 수강 내역, 시간표는 이용자가 직접 입력한 것이 아니라{" "}
                <b>학교 학사 시스템에서 수집</b>합니다. 급식 정보는 학교 급식 시스템에서
                받아 옵니다. 「개인정보 보호법」 제20조에 따라 정보주체가 요구하면 수집
                출처와 처리 목적을 알려 드립니다. 요구는 아래 9항의 연락처로 해주세요.
            </P>

            <H2>4. 개인정보의 처리 및 보유 기간</H2>
            <Table
                head={["항목", "보유 기간"]}
                rows={[
                    ["계정 정보, 학번, 구글 계정 주소", "계정을 지울 때까지"],
                    [
                        "이용자가 입력한 기록(이수 기록·일정·친구·계획)",
                        "계정을 지울 때까지. 이용자가 화면에서 직접 지울 수 있습니다",
                    ],
                    [
                        "접속 기록(IP·기기·세션)",
                        "마지막 사용으로부터 30일. 지나면 세션이 만료되고, 이용자가 직접 끊으면 즉시 삭제됩니다",
                    ],
                    [
                        "학사 정보",
                        "학기 단위로 보관합니다. 수집할 때마다 덮어쓰지 않고 회차로 쌓아 두어, 지난 학기 시간표를 되돌려 볼 수 있습니다",
                    ],
                ]}
            />

            <H2>5. 개인정보의 제3자 제공</H2>
            <P>
                서비스는 이용자의 개인정보를 <b>제3자에게 제공하지 않습니다.</b> 법령에
                따라 제출 의무가 생기거나 수사기관이 적법한 절차로 요구하는 경우에만
                예외로 합니다.
            </P>
            <P>
                다만 같은 학교 구성원끼리는 서비스 안에서 서로의 시간표를 조회할 수
                있습니다. 이것이 서비스의 기능이며, <b>로그인한 사람에게만</b> 열립니다.
                친구 화면은 과목명 없이 언제 비어 있는지만 보여 줍니다.
            </P>

            <H2>6. 개인정보 처리의 위탁과 국외 이전</H2>
            <P>
                서비스는 개인정보 처리를 다른 사업자에게 위탁하지 않습니다. 다만 서비스를
                운영하는 과정에서 아래와 같이 국외 사업자의 설비를 거칩니다.
            </P>
            <Table
                head={["받는 자", "국가", "이전되는 항목", "목적"]}
                rows={[
                    [
                        "Netlify, Inc.",
                        "미국",
                        "접속 IP, 브라우저 정보",
                        "화면 파일을 전송하는 호스팅. 이 설비에는 계정·학사 정보가 저장되지 않습니다",
                    ],
                    [
                        "Google LLC",
                        "미국",
                        "학교 구글 계정 주소, 광고 식별에 쓰이는 쿠키",
                        "학번 확인, 광고 게재",
                    ],
                ]}
            />
            <P>
                계정 정보와 학사 정보가 담긴 데이터베이스는 <b>국내 서버</b>에 두고
                운영합니다. 이전을 원하지 않으면 서비스 이용을 중단할 수 있으나, 화면을
                받아 오는 과정 자체가 호스팅을 거치므로 그 부분만 따로 거부할 수는
                없습니다.
            </P>

            <H2>7. 개인정보를 자동으로 수집하는 장치</H2>
            <P>
                서비스는 로그인 상태를 유지하기 위해 브라우저의 저장 공간(localStorage)에
                세션 식별자를 둡니다. 이 값은 로그아웃하면 지워지고, 광고나 분석에 쓰이지
                않습니다.
            </P>
            <P>
                <b>광고 쿠키</b> — 서비스는 Google 애드센스를 통해 광고를 게재합니다.
                Google을 비롯한 제3자 공급업체는 쿠키를 사용해 이용자가 이전에 이 사이트나
                다른 사이트를 방문한 기록을 토대로 광고를 게재합니다. 이용자는{" "}
                <A href="https://www.google.com/settings/ads">Google 광고 설정</A>에서
                개인 맞춤 광고를 사용하지 않도록 설정할 수 있고,{" "}
                <A href="https://www.aboutads.info/choices/">www.aboutads.info</A>에서
                제3자 공급업체가 개인 맞춤 광고에 쿠키를 사용하는 것을 거부할 수 있습니다.
                브라우저 설정에서 쿠키를 차단할 수도 있으나, 그렇게 하면 일부 화면이
                정상적으로 동작하지 않을 수 있습니다.
            </P>

            <H2>8. 정보주체의 권리와 행사 방법</H2>
            <P>
                이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를
                요구할 수 있습니다. 만 14세 미만 아동의 개인정보는 법정대리인의 동의를
                받아 처리하며, 법정대리인이 같은 권리를 행사할 수 있습니다.
            </P>
            <Ul
                items={[
                    <>
                        이수 기록, 개인 일정, 친구 목록은 <b>화면에서 직접</b> 고치거나
                        지울 수 있습니다.
                    </>,
                    <>
                        로그인해 둔 기기는 <code>/about</code> 화면에서 직접 끊을 수
                        있습니다.
                    </>,
                    <>
                        계정 삭제, 시간표 노출 중지처럼 화면에서 처리할 수 없는 요구는
                        아래 연락처로 보내주세요. 접수 후 <b>10일 이내</b>에 처리하고
                        결과를 알려 드립니다.
                    </>,
                ]}
            />

            <H2>9. 개인정보 보호책임자</H2>
            <P>
                서비스의 개인정보 처리에 관한 업무를 총괄해 책임지며, 관련 문의와 불만,
                피해 구제를 접수합니다.
            </P>
            <RetroCard shadow="sm" className="mt-4 bg-white p-5">
                <p className="text-[13px] font-bold text-black/40">
                    개인정보 보호책임자 · 운영자
                </p>
                <p className="mt-2 text-lg font-black">백재원</p>
                <p className="mt-1 text-[14px] font-bold">
                    <A href={`mailto:${CONTACT}`}>{CONTACT}</A>
                </p>
            </RetroCard>

            <H2>10. 개인정보의 안전성 확보 조치</H2>
            <Ul
                items={[
                    <>
                        비밀번호는 단방향 암호화하여 저장하므로 원문을 알 수 없습니다.
                    </>,
                    <>
                        모든 통신은 HTTPS로 암호화합니다.
                    </>,
                    <>
                        로그인하지 않으면 이 방침과 소개 화면 말고는 아무것도 열리지
                        않습니다. 이름과 시간표가 담긴 응답은 전부 로그인을 요구합니다.
                    </>,
                    <>
                        한 학번은 한 계정만 가질 수 있게 하고, 학번은 학교 구글 계정으로
                        확인합니다. 남의 학번으로 계정을 만들 수 없습니다.
                    </>,
                    <>
                        계정 관리와 데이터 수집 기능은 관리자 권한을 가진 계정에만
                        열립니다.
                    </>,
                    <>데이터베이스는 정기적으로 백업하고 접근 권한을 제한합니다.</>,
                ]}
            />

            <H2>11. 개인정보의 파기</H2>
            <P>
                보유 기간이 지나거나 처리 목적이 끝난 개인정보는 지체 없이 파기합니다.
                전자적 파일은 복구할 수 없는 방법으로 삭제합니다. 다만 이미 만들어 둔
                백업본에 남아 있는 정보는 백업 보관 주기가 지나면 함께 삭제됩니다.
            </P>

            <H2>12. 권익침해 구제 방법</H2>
            <P>
                개인정보 침해로 인한 신고나 상담이 필요하면 아래 기관에 문의할 수
                있습니다.
            </P>
            <Ul
                items={[
                    <>
                        개인정보 침해신고센터 — (국번없이) 118 ·{" "}
                        <A href="https://privacy.kisa.or.kr">privacy.kisa.or.kr</A>
                    </>,
                    <>
                        개인정보 분쟁조정위원회 — 1833-6972 ·{" "}
                        <A href="https://www.kopico.go.kr">www.kopico.go.kr</A>
                    </>,
                    <>
                        대검찰청 사이버수사과 — (국번없이) 1301 ·{" "}
                        <A href="https://www.spo.go.kr">www.spo.go.kr</A>
                    </>,
                    <>
                        경찰청 사이버수사국 — (국번없이) 182 ·{" "}
                        <A href="https://ecrm.police.go.kr">ecrm.police.go.kr</A>
                    </>,
                ]}
            />

            <H2>13. 방침의 변경</H2>
            <P>
                이 방침의 내용을 추가하거나 삭제, 수정할 때에는 시행 <b>7일 전</b>부터 이
                화면에 알립니다. 다만 수집 항목이나 이용 목적처럼 이용자의 권리에 중요한
                변경이 있을 때에는 <b>30일 전</b>에 알립니다.
            </P>

            <div className="mt-12 border-t-2 border-black pt-6">
                <p className="text-[13px] font-bold text-black/40">
                    이 방침은 {UPDATED}부터 적용됩니다.
                </p>
            </div>
        </main>

        <footer className="border-t-2 border-black bg-black px-5 py-8 text-white md:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                    Class Explorer · KSA
                </span>
                <a
                    href={`mailto:${CONTACT}`}
                    className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 transition-colors duration-100 hover:text-white"
                >
                    {CONTACT}
                </a>
            </div>
        </footer>
    </div>
);

export default PrivacyPage;
