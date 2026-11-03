import type { RequestOptions } from "../core/transport.js";
import { intInRange, pathName, queryText } from "../core/validate.js";
import { ValidationError } from "../errors.js";
import type { operations } from "../generated/openapi.js";
import type {
  ExerciseTime,
  ExperienceGoal,
  ExperienceStatus,
  HuntSplit,
  LevelExperience,
  Online,
  OnlineBatch,
  RawSkills,
  ShareExperience,
  VocationStatus,
} from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

type Query<K extends keyof operations> = NonNullable<operations[K]["parameters"]["query"]>;
type Path<K extends keyof operations> = NonNullable<operations[K]["parameters"]["path"]>;

/** Options of {@link OnlineResource.list}. */
export interface OnlineListOptions {
  /** `names` returns only the names in `online`; `full` (default) returns players. */
  fields?: Query<"getOnlineBatch">["fields"] | undefined;
  /** ETag of a previous response: answers `notModified: true` (no quota used) when nothing changed. */
  ifNoneMatch?: string | undefined;
}

/** Result of {@link OnlineResource.list}. */
export type OnlineListResult =
  | { notModified: false; etag: string | undefined; data: OnlineBatch }
  | { notModified: true; etag: string | undefined; data: undefined };

/** Base vocation accepted by {@link ToolsResource.vocationStatus}. */
export type BaseVocation = Path<"getVocationStatus">["vocation"];
/** Parameters of {@link ToolsResource.rawSkills}. */
export type RawSkillsOptions = Query<"getRawSkills">;
/** Current progress for {@link ToolsResource.experienceGoal}: either the level or the experience. */
export type ExperienceGoalFrom =
  | { level: number; experience?: never }
  | { experience: number | bigint; level?: never };

const MAX_LEVEL = 821_009;
const MAX_EXPERIENCE = 9_223_372_036_854_775_807n;
const MAX_HUNT_BYTES = 65_536;
const VOCATIONS: readonly string[] = ["druid", "knight", "monk", "paladin", "sorcerer"];

function experience(label: string, value: unknown): string {
  if (typeof value === "bigint") {
    if (value < 0n || value > MAX_EXPERIENCE) {
      throw new ValidationError(`${label} must be between 0 and ${MAX_EXPERIENCE}.`);
    }
    return value.toString();
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative integer (use a bigint above 2^53).`);
  }
  return String(value);
}

/** Tools: who is online. */
export class OnlineResource extends Resource {
  /**
   * Who is online in up to 100 worlds, in one call (counts 1 against the quota).
   * Pass the previous `etag` as `ifNoneMatch` to get `notModified: true` without using quota.
   *
   * @example
   * ```ts
   * let etag: string | undefined;
   * const res = await client.online.list(["Antica", "Yonabra"], { ifNoneMatch: etag });
   * if (!res.notModified) console.log(res.data.worlds);
   * etag = res.etag;
   * ```
   */
  public async list(
    worlds: readonly string[],
    filters: OnlineListOptions = {},
    options?: RequestOptions,
  ): Promise<OnlineListResult> {
    if (!Array.isArray(worlds) || worlds.length === 0) {
      throw new ValidationError("worlds must be a non-empty array of world names.");
    }
    const names = worlds.map((w) => pathName("World", w, { strict: true }));
    if (new Set(names.map((n) => n.toLowerCase())).size > 100) {
      throw new ValidationError("worlds accepts up to 100 different worlds.");
    }
    const headers: Record<string, string> = {};
    if (filters.ifNoneMatch !== undefined) {
      headers["If-None-Match"] = queryText("ifNoneMatch", filters.ifNoneMatch, 200);
    }
    const response = await this.send<OnlineBatch>({
      method: "GET",
      path: "/v2/tools/online",
      query: { worlds: names, fields: filters.fields },
      headers,
      options,
    });
    const etag = response.headers["etag"];
    if (response.notModified) return { notModified: true, etag, data: undefined };
    const data = response.data as OnlineBatch;
    this.#observe(data);
    return { notModified: false, etag, data };
  }

  /** Whether a character is online in their world, with level and vocation. */
  public async character(name: string, options?: RequestOptions): Promise<Online> {
    const value = pathName("Character name", name);
    return this.call<Online>(`/v2/tools/online/${seg(value)}`, options);
  }

  #observe(data: OnlineBatch): void {
    const stale = (data.worlds ?? []).filter((w) => w.stale).map((w) => w.name);
    if (stale.length > 0) {
      this.warn({
        code: "STALE_DATA",
        message: `Online lists served from cache (the new read failed): ${stale.join(", ")}.`,
        details: { worlds: stale },
      });
    }
    const failed = data.failed ?? [];
    const unknown = data.unknown ?? [];
    if (failed.length > 0 || unknown.length > 0) {
      this.warn({
        code: "PARTIAL_FAILURE",
        message: `Some worlds have no online list: ${[...failed.map((f) => `${f.name} (${f.status_code})`), ...unknown.map((u) => `${u} (unknown)`)].join(", ")}.`,
        details: { failed, unknown },
      });
    }
  }
}

/** Tools: experience, vocations, skills, exercise weapons and party hunts. */
export class ToolsResource extends Resource {
  /** Party share range of one level, or of up to 100 levels. */
  public async shareExperience(
    levels: number | readonly number[],
    options?: RequestOptions,
  ): Promise<ShareExperience> {
    const list = Array.isArray(levels) ? levels : [levels];
    if (list.length === 0 || list.length > 100) {
      throw new ValidationError("levels must have between 1 and 100 levels.");
    }
    const values = list.map((l) => intInRange("level", l, 1, 100_000));
    return this.call<ShareExperience>(`/v2/tools/experience/share/${values.join(",")}`, options);
  }

  /** Hit points, mana and capacity of a vocation at a level. */
  public async vocationStatus(
    vocation: BaseVocation,
    level: number,
    options?: RequestOptions,
  ): Promise<VocationStatus> {
    const v = typeof vocation === "string" ? vocation.trim().toLowerCase() : "";
    if (!VOCATIONS.includes(v)) {
      throw new ValidationError(`vocation must be one of: ${VOCATIONS.join(", ")}.`);
    }
    const l = intInRange("level", level, 1, 100_000);
    return this.call<VocationStatus>(`/v2/tools/vocationstatus/${seg(v)}/${seg(l)}`, options);
  }

  /**
   * Raw skill values from the skills shown online, with loyalty applied.
   *
   * @example
   * ```ts
   * const raw = await client.tools.rawSkills({ vocation: "knight", sword: "110,45.5", loyalty: 15 });
   * ```
   */
  public async rawSkills(params: RawSkillsOptions, options?: RequestOptions): Promise<RawSkills> {
    if (typeof params !== "object" || params === null) {
      throw new ValidationError("rawSkills needs at least the vocation.");
    }
    const query: Record<string, string | number | undefined> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query[key] = typeof value === "number" ? value : queryText(key, value, 40);
    }
    return this.call<RawSkills>("/v2/tools/skills/raw", options, query);
  }

  /** Time needed to spend a number of exercise weapon charges. */
  public async exerciseWeapons(charges: number, options?: RequestOptions): Promise<ExerciseTime> {
    const c = intInRange("charges", charges, 1, 1_000_000_000_000);
    return this.call<ExerciseTime>(`/v2/tools/exerciseweapons/${seg(c)}`, options);
  }

  /** Experience needed to reach a level. */
  public async experienceForLevel(
    level: number,
    options?: RequestOptions,
  ): Promise<LevelExperience> {
    const l = intInRange("level", level, 1, MAX_LEVEL);
    return this.call<LevelExperience>(`/v2/tools/experience/level/${seg(l)}`, options);
  }

  /** Level and progress of an amount of experience. Accepts a bigint above 2^53. */
  public async levelForExperience(
    experiencePoints: number | bigint,
    options?: RequestOptions,
  ): Promise<ExperienceStatus> {
    const e = experience("experience", experiencePoints);
    return this.call<ExperienceStatus>(`/v2/tools/experience/points/${e}`, options);
  }

  /** Experience missing to reach `targetLevel`, from the current level or experience. */
  public async experienceGoal(
    targetLevel: number,
    from: ExperienceGoalFrom,
    options?: RequestOptions,
  ): Promise<ExperienceGoal> {
    const target = intInRange("targetLevel", targetLevel, 1, MAX_LEVEL);
    const hasLevel = from?.level !== undefined;
    const hasExperience = from?.experience !== undefined;
    if (hasLevel === hasExperience) {
      throw new ValidationError("Pass either the current level or the current experience.");
    }
    const query = hasLevel
      ? { level: intInRange("level", from.level, 1, MAX_LEVEL) }
      : { experience: experience("experience", from.experience) };
    return this.call<ExperienceGoal>(`/v2/tools/experience/goal/${seg(target)}`, options, query);
  }

  /**
   * Splits the profit or waste of a party hunt from the Party Hunt Analyzer text.
   * Sent once (POST, never retried); the text is not logged by the SDK.
   */
  public async splitHunt(analyzerText: string, options?: RequestOptions): Promise<HuntSplit> {
    if (typeof analyzerText !== "string" || analyzerText.trim() === "") {
      throw new ValidationError("splitHunt needs the Party Hunt Analyzer text.");
    }
    if (new TextEncoder().encode(analyzerText).length > MAX_HUNT_BYTES) {
      throw new ValidationError("The Party Hunt Analyzer text must be up to 64 KB.");
    }
    const response = await this.send<HuntSplit>({
      method: "POST",
      path: "/v2/tools/hunt/split",
      text: analyzerText,
      options,
    });
    return response.data as HuntSplit;
  }
}
