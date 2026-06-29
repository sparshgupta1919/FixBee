const PageLoader = () => (
    <div className="flex items-center justify-center h-[100dvh] bg-background-light dark:bg-background-dark">
        <style>{`
            @keyframes logo-breath {
                0%, 100% {
                    transform: scale(0.92);
                    opacity: 0.8;
                }
                50% {
                    transform: scale(1.08);
                    opacity: 1;
                    box-shadow: 0 10px 30px rgba(73, 145, 255, 0.25);
                }
            }
            .animate-logo-breath {
                animation: logo-breath 1.8s ease-in-out infinite;
            }
        `}</style>
        <div className="flex flex-col items-center gap-4">
            <div className="animate-logo-breath w-24 h-24 rounded-full overflow-hidden bg-white border-[3px] border-[#FDC938]/30 shadow-[0_8px_24px_rgba(73,145,255,0.15)] flex items-center justify-center">
                <img 
                    src="/fixbee-logo.svg" 
                    alt="Loading..." 
                    className="w-full h-full object-cover rounded-full"
                />
            </div>

        </div>
    </div>
);

export default PageLoader;
