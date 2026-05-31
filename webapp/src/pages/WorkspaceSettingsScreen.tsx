import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { SettingsTabs, type SettingsTabId } from "../components/SettingsTabs";
import { GeneralSection } from "../components/GeneralSection";
import { InvitationsSection } from "../components/InvitationsSection";
import { MembersListSection } from "../components/MembersListSection";
import { RoomsSection } from "../components/RoomsSection";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useTranslation, type TranslationKey } from "../i18n";

interface Props {
  workspaceId: number;
  onBack: () => void;
}

const ROLE_LABEL_KEY: Record<"owner" | "admin" | "member", TranslationKey> = {
  owner: "members_section.role.owner",
  admin: "members_section.role.admin",
  member: "members_section.role.member",
};

function tabsForRole(role: "owner" | "admin" | "member" | null): SettingsTabId[] {
  if (role === "owner" || role === "admin") {
    return ["general", "invitations", "members", "rooms"];
  }
  // member видит только участников и переговорные
  return ["members", "rooms"];
}

function defaultTabForRole(role: "owner" | "admin" | "member" | null): SettingsTabId {
  return role === "owner" || role === "admin" ? "general" : "members";
}

export function WorkspaceSettingsScreen({ workspaceId, onBack }: Props) {
  const { t } = useTranslation();
  const { data: workspace, isLoading } = useWorkspaceDetail(workspaceId);
  const myRole = workspace?.my_role ?? null;
  const tabs = tabsForRole(myRole);

  // Дожидаемся загрузки workspace перед тем как ставить дефолтный таб
  // (иначе owner стартует с "members" — initial useState считается до загрузки).
  const [currentTab, setCurrentTab] = useState<SettingsTabId | null>(null);
  useEffect(() => {
    if (myRole && currentTab === null) {
      setCurrentTab(defaultTabForRole(myRole));
    }
  }, [myRole, currentTab]);

  // Защита: если текущий таб больше не доступен (роль изменилась) — fallback.
  const activeTab: SettingsTabId | null =
    currentTab && tabs.includes(currentTab) ? currentTab : null;

  useTgBackButton(onBack);

  const title = workspace?.name ?? t("ws_settings.title");

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={title} onBack={onBack} />

      {workspace && myRole && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("ws_settings.your_role", {
            role: t(ROLE_LABEL_KEY[myRole]).toLowerCase(),
          })}
        </p>
      )}

      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {workspace && activeTab && (
        <>
          <SettingsTabs
            tabs={tabs}
            current={activeTab}
            onChange={setCurrentTab}
          />

          {activeTab === "general" && (
            <GeneralSection workspace={workspace} onArchived={onBack} />
          )}
          {activeTab === "invitations" && (
            <InvitationsSection workspace={workspace} />
          )}
          {activeTab === "members" && (
            <MembersListSection workspaceId={workspaceId} />
          )}
          {activeTab === "rooms" && (
            <RoomsSection workspaceId={workspaceId} />
          )}
        </>
      )}
    </div>
  );
}
