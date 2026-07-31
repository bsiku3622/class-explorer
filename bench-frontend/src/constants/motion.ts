// 툴팁용 애니메이션 설정 (위치 튐 방지 및 순수 Opacity 전환)
export const tooltipMotionProps = {
    initial: { opacity: 0, x: 0, y: 0, scale: 1 },
    variants: {
        enter: {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            transition: {
                opacity: { duration: 0.1 },
            },
        },
        exit: {
            opacity: 0,
            x: 0,
            y: 0,
            scale: 1,
            transition: {
                opacity: { duration: 0.1 },
            },
        },
    },
};
