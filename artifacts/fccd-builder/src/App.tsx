import { useUniverseStore } from '@/store';
import type { ScreenId } from '@/types';
import { ControlsModal } from '@/components/ControlsModal';
import { UniverseDrawer } from '@/components/UniverseDrawer';

import UniverseInfoScreen    from '@/screens/UniverseInfoScreen';
import ConferenceCountScreen from '@/screens/ConferenceCountScreen';
import ConferenceSetupScreen from '@/screens/ConferenceSetupScreen';
import DraftTeamsScreen      from '@/screens/DraftTeamsScreen';
import PrestigeReviewScreen  from '@/screens/PrestigeReviewScreen';
import RivalriesScreen       from '@/screens/RivalriesScreen';
import OOCRivalriesScreen    from '@/screens/OOCRivalriesScreen';
import BowlDraftScreen       from '@/screens/BowlDraftScreen';
import BowlTieInsScreen      from '@/screens/BowlTieInsScreen';
import ReviewExportScreen    from '@/screens/ReviewExportScreen';

const SCREENS: Record<ScreenId, React.ComponentType> = {
  'universe-info':    UniverseInfoScreen,
  'conference-count': ConferenceCountScreen,
  'conference-setup': ConferenceSetupScreen,
  'draft-teams':      DraftTeamsScreen,
  'prestige-review':  PrestigeReviewScreen,
  'rivalries':        RivalriesScreen,
  'ooc-rivalries':    OOCRivalriesScreen,
  'bowl-draft':       BowlDraftScreen,
  'bowl-tie-ins':     BowlTieInsScreen,
  'review-export':    ReviewExportScreen,
};

export default function App() {
  const currentScreen = useUniverseStore((s) => s.currentScreen);
  const Screen = SCREENS[currentScreen] ?? UniverseInfoScreen;
  return (
    <>
      <Screen />
      <ControlsModal />
      <UniverseDrawer />
    </>
  );
}
