import React from "react";
import { HelpCircle, Search, X } from "lucide-react";
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    Input,
    Tooltip,
} from "@heroui/react";
import { tooltipMotionProps } from "../constants/motion";

interface NavigationProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({
    searchTerm,
    setSearchTerm,
}) => {
    return (
        <Navbar
            isBordered={false}
            className="fixed top-0 left-0 right-0 bg-retro-secondary border-b border-black h-20 shadow-[0_4px_0_0_rgba(0,0,0,0.2)] z-1000"
            maxWidth="full"
        >
            <NavbarBrand>
                <p className="text-2xl font-black italic tracking-tighter text-white uppercase transform -skew-x-6">
                    Class Explorer
                </p>
            </NavbarBrand>
            <NavbarContent className="hidden sm:flex gap-4 h-12" justify="end">
                <div className="relative h-full">
                    <Input
                        labelPlacement="outside"
                        classNames={{
                            base: "w-96 h-full",
                            input: "h-full text-base font-semibold px-2 pr-10 flex-1 h-full focus:outline-none",
                            inputWrapper:
                                "h-full bg-white border-2 border-black rounded-none data-[hover=true]:border-black group-data-[focus=true]:border-black px-4 flex items-center outline-none ring-0 relative",
                            innerWrapper:
                                "h-full flex flex-row items-center gap-2 w-full h-full",
                        }}
                        placeholder="Search by Something..."
                        startContent={
                            <Search className="text-black/60 shrink-0" size={18} />
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="text-black/40 hover:text-black/70 transition-colors p-1"
                            >
                                <X size={18} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>

                <Tooltip
                    placement="bottom-end"
                    className="max-w-100"
                    content={
                        <div className="p-6 space-y-6 min-w-96">
                            <p className="font-black text-lg border-b border-black pb-2 mb-4 uppercase italic">
                                Search Guide
                            </p>
                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                        Basic & Logic Search
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                키워드 검색
                                            </span>
                                            <p className="text-sm font-bold">
                                                이름, 학번, 과목, 선생님 성함
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                논리 연산
                                            </span>
                                            <div>
                                                <p className="text-sm font-bold">
                                                    대상간의 공통/합집합 분반을
                                                    리스트업
                                                </p>
                                                <p className="text-sm font-bold mt-1.5">
                                                    <span className="text-retro-primary font-black">
                                                        &
                                                    </span>{" "}
                                                    (같은 과목),{" "}
                                                    <span className="text-retro-primary font-black">
                                                        &&
                                                    </span>{" "}
                                                    (같은 분반)
                                                </p>
                                                <p className="text-sm font-bold">
                                                    <span className="text-retro-primary font-black">
                                                        +
                                                    </span>{" "}
                                                    (OR),{" "}
                                                    <span className="text-retro-primary font-black">
                                                        ( )
                                                    </span>{" "}
                                                    (괄호) 지원
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                과목 / 인물
                                            </span>
                                            <p className="text-sm font-bold leading-snug">
                                                특정 과목 내에서 특정 인물을
                                                검색
                                                <br />
                                                <span className="text-xs text-black/40 italic">
                                                    예: 미적분학 / 유지원
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                        Advanced Search
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                student:학번
                                            </span>
                                            <p className="text-sm font-bold">
                                                학생 집중 검색 (학번만 가능)
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                teacher:성함
                                            </span>
                                            <p className="text-sm font-bold">
                                                선생님 집중 검색
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-5 border-t border-black/10">
                                    <div className="flex items-start gap-2">
                                        <span className="bg-retro-primary text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                            TIP
                                        </span>
                                        <p className="text-sm font-bold leading-snug">
                                            <span className="text-retro-primary font-black">
                                                Ctrl (또는 Cmd)
                                            </span>{" "}
                                            키를 누른 상태로 이름 위에 마우스를
                                            가져가면 상세 정보를 볼 수 있습니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                    motionProps={tooltipMotionProps}
                    classNames={{
                        content:
                            "rounded-none border border-black bg-white shadow-[4px_4px_0_0_rgba(120,40,200,0.3)]",
                    }}
                >
                    <div className="w-12 h-12 flex items-center justify-center border-2 border-black bg-white text-black hover:bg-retro-accent1 cursor-help transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex-none">
                        <HelpCircle size={24} strokeWidth={2.5} />
                    </div>
                </Tooltip>
            </NavbarContent>
        </Navbar>
    );
};

export default Navigation;
