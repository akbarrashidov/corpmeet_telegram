import type { Lang } from "../i18n";
import type { WorkspacePosition } from "../hooks/usePositions";

/**
 * Локализованное название должности для текущего языка.
 * uz → name_uz, остальное → name_ru.
 */
export function getPositionLabel(
  position: Pick<WorkspacePosition, "name_ru" | "name_uz">,
  lang: Lang,
): string {
  return lang === "uz" ? position.name_uz : position.name_ru;
}
