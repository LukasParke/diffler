import {
  githubStatsInputSchema,
  hasPrivateRepositoryDetails,
  isCardId,
  presentationSchema,
  sourcePropsSchema,
  type CardId,
  type GitHubStatsInput,
  type PresentationData,
  type SourceProps,
} from "@lukasparke/diffler-schemas";
import { ProfileAssetsConfigSchema, type ProfileAssetsConfig } from "../config.js";

function parseStats(stats: unknown): GitHubStatsInput {
  const result = githubStatsInputSchema.safeParse(stats);
  if (!result.success) {
    throw new Error("Cannot export Remotion data: expected valid collected GitHub stats");
  }
  return result.data;
}

export function remotionInput(
  stats: unknown,
  options: Pick<SourceProps, "allowPrivateRepositoryDetails"> = {}
): SourceProps {
  const data = parseStats(stats);
  const input = {
    username: data.schemaVersion === 2 ? data.profile.login : data.username,
    stats: data,
    allowPrivateRepositoryDetails: options.allowPrivateRepositoryDetails ?? false,
  };
  if (!sourcePropsSchema.safeParse(input).success) {
    throw new Error("Invalid Remotion input options: allowPrivateRepositoryDetails must be a boolean");
  }
  if (hasPrivateRepositoryDetails(data) && !input.allowPrivateRepositoryDetails) {
    throw new Error("Private repository details require allowPrivateRepositoryDetails: true");
  }
  return input;
}

export function profileAsset(
  card = "readme",
  options: Partial<ProfileAssetsConfig> = {}
): string {
  const result = ProfileAssetsConfigSchema.safeParse(options);
  if (!result.success) {
    throw new Error("Invalid profile asset settings: use a public asset base URL and webp or gif format");
  }
  if (!isCardId(card)) {
    throw new Error("Invalid profile card name");
  }
  const { baseUrl, format } = result.data;
  return `${baseUrl.replace(/\/+$/, "")}/${card}.${format}`;
}

// Older stats exports used narrative section names rather than renderer card IDs.
const legacySceneIds = new Map<string, CardId>([
  ["intro", "readme"],
  ["contributions", "activity-overview"],
  ["repositories", "repo-impact"],
]);

function sceneCardId(scene: string): CardId {
  const id = legacySceneIds.get(scene) ?? scene;
  if (!isCardId(id)) throw new Error("Unknown Remotion card; use a registered card ID");
  return id;
}

const sceneMetadataSchema = presentationSchema.shape.remotion.extend({
  scenes: presentationSchema.shape.remotion.shape.scenes.element.strict().array(),
}).strict();

/** Compatibility helper for descriptive metadata, not renderer composition props. */
export function remotionSceneConfig(
  scene: string,
  stats: unknown
): PresentationData["remotion"]["scenes"][number] {
  const id = sceneCardId(scene);
  const metadata = remotionSceneManifest(stats).scenes.find((entry) => entry.id === id);
  if (!metadata) throw new Error("No metadata is available for the requested card");
  return metadata;
}

export function remotionSceneManifest(
  stats: unknown,
  sceneTemplate?: string
): PresentationData["remotion"] {
  const data = parseStats(stats);
  const scenes = data.schemaVersion === 2 ? data.presentation?.remotion?.scenes ?? [] : [];
  let metadata: PresentationData["remotion"] = { scenes };
  if (sceneTemplate !== undefined) {
    let template: unknown;
    try {
      template = JSON.parse(sceneTemplate);
    } catch {
      throw new Error("Scene metadata must be valid JSON; template rendering is not supported");
    }
    const result = sceneMetadataSchema.safeParse(template);
    if (!result.success) {
      throw new Error("Invalid scene metadata; theme, duration, and renderer config overrides are not supported");
    }
    metadata = result.data;
  }
  return { scenes: metadata.scenes.map((scene) => ({ ...scene, id: sceneCardId(scene.id) })) };
}
