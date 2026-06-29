import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LocationStep from './LocationStep';
import CommunityStep from './CommunityStep';
import { useAuth } from '../../context/AuthContext';
import './Onboarding.css';
import './CampusSelectionPage.css';
import path1Bg from '../../assets/signin/path-1.svg';
import path2Bg from '../../assets/signin/path-2.svg';
import path3Bg from '../../assets/signin/path-3.svg';
import path4Bg from '../../assets/signin/path-4.svg';

const OnboardingPage = () => {
    const { userProfile } = useAuth();
    const location = useLocation();
    
    // Default to Location (step 1) if forceStep is passed, otherwise based on profile
    const initialStep = location.state?.forceStep !== undefined 
        ? location.state.forceStep 
        : (userProfile?.locationGranted ? 2 : 1);
        
    const [step, setStep] = useState(initialStep); // 1 = Location, 2 = Community

    const handleNext = () => {
        setStep(2);
    };

    return (
        <div className="onboarding-container bg-white h-[100dvh] w-full overflow-hidden relative">
            {/* Shared background bee paths — rendered once for both steps */}
            <div className="signin-bg">
                <div className="bg-path path-1">
                    <img src={path1Bg} alt="" aria-hidden="true" />
                </div>
                <div className="bg-path path-4">
                    <img src={path4Bg} alt="" aria-hidden="true" />
                </div>
                <div className="bg-path path-3">
                    <img src={path3Bg} alt="" aria-hidden="true" />
                </div>
                <div className="bg-path path-2">
                    <img src={path2Bg} alt="" aria-hidden="true" />
                </div>
            </div>
            {/* Sliding Wrapper */}
            <div
                className="w-full h-full flex transition-transform duration-500 ease-in-out relative z-10"
                style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
            >
                {/* Step 1 — Location */}
                <div className="w-full h-full flex-shrink-0 relative z-10 overflow-y-auto">
                    <LocationStep onNext={handleNext} />
                </div>

                {/* Step 2 — Community */}
                <div className="w-full h-full flex-shrink-0 relative z-10 overflow-y-auto">
                    <CommunityStep />
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
