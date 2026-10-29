import { tr } from "../../i18n/store";
import { command, type Campaign } from "../journal/api";

export interface FirstStart {
  demoCampaignId: string | null;
  tourSeen: boolean;
}

/**
 * Visible demo text in the interface language. `{0}`/`{1}` stay untranslated markers:
 * the backend turns them into mentions of the demo pages and refuses text that drops one.
 */
export function demoText() {
  return {
    campaign: tr("Demo — The Salt Tower"),
    town: tr("Harrowgate"),
    townText: tr(
      "A fishing town on the river Vey, where the party met. Demo page: edit or delete it freely.",
    ),
    innkeeper: tr("Mira"),
    innkeeperText: tr(
      "Innkeeper of the Drowned Lantern. She hears every rumour in town.",
    ),
    baron: tr("Baron Aldric"),
    baronText: tr("Lord of Harrowgate, rarely seen since the autumn floods."),
    tower: tr("The Salt Tower"),
    towerText: tr("A ruined watchtower on the cliffs north of the river."),
    session1: tr("Arrival in Harrowgate"),
    session1Arrival: tr(
      "We reached {0} at dusk and took rooms at the inn run by {1}.",
    ),
    session1Claim: tr(
      "{0} told us that {1} poisoned the town well. Nobody else has confirmed it.",
    ),
    session2: tr("The road to the Salt Tower"),
    session2Path: tr(
      "We followed the cliff path north to {0}. Fresh boot prints led inside.",
    ),
    session2Seal: tr("A broken seal on the door bore the crest of {0}."),
    livesIn: tr("lives in"),
    rules: tr("rules"),
    rulesEvidence: tr("Common knowledge in town."),
    linkedTo: tr("linked to"),
    linkedEvidence: tr("His crest on a broken seal at the door."),
    rumour: tr("Mira claims the Baron poisoned the well"),
    rumourDetails: tr("Only her word so far. A claim, not a fact."),
    question: tr("Who was inside the Salt Tower?"),
    questionDetails: tr("Fresh boot prints led through the door."),
    character: tr("Ilsa Marrow"),
    ancestry: tr("Human"),
    vocation: tr("Ranger"),
    characterNotes: tr(
      "Demo character. Change anything: the values are whatever you enter.",
    ),
  };
}

export const onboardingApi = {
  firstStart: () => command<FirstStart>("get_first_start"),
  setTourSeen: (seen: boolean) =>
    command<FirstStart>("set_tour_seen", { seen }),
  createDemo: () =>
    command<Campaign>("create_demo_campaign", { text: demoText() }),
  removeDemo: (campaignId: string) =>
    command<void>("remove_demo_campaign", { campaignId }),
};
