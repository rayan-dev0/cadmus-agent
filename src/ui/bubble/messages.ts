import { ToolCardOptions } from "../toolCards.js";
import { CommandItem } from "../commandCatalog.js";

export class TokenChunkMsg {
  readonly _tag = "TokenChunkMsg";
  constructor(public readonly token: string) {}
}

export class TurnStartMsg {
  readonly _tag = "TurnStartMsg";
  constructor(public readonly prompt: string) {}
}

export class TurnFinishedMsg {
  readonly _tag = "TurnFinishedMsg";
  constructor(public readonly reply: string) {}
}

export class TurnErrorMsg {
  readonly _tag = "TurnErrorMsg";
  constructor(public readonly error: string) {}
}

export class ToolStartMsg {
  readonly _tag = "ToolStartMsg";
  constructor(
    public readonly toolName: string,
    public readonly args: any
  ) {}
}

export class ToolCompleteMsg {
  readonly _tag = "ToolCompleteMsg";
  constructor(
    public readonly toolName: string,
    public readonly args: any,
    public readonly output: string,
    public readonly success: boolean,
    public readonly durationMs: number
  ) {}
}

export class DiffApprovalRequestMsg {
  readonly _tag = "DiffApprovalRequestMsg";
  constructor(
    public readonly options: {
      filePath: string;
      patch: string;
      additions: number;
      deletions: number;
    },
    public readonly resolve: (action: "accept" | "reject" | "always") => void
  ) {}
}

export class DiffApprovalResolvedMsg {
  readonly _tag = "DiffApprovalResolvedMsg";
  constructor(public readonly action: "accept" | "reject" | "always") {}
}

export class ConfirmationRequestMsg {
  readonly _tag = "ConfirmationRequestMsg";
  constructor(
    public readonly prompt: string,
    public readonly resolve: (allow: boolean) => void
  ) {}
}

export class ConfirmationResolvedMsg {
  readonly _tag = "ConfirmationResolvedMsg";
  constructor(public readonly allow: boolean) {}
}

export class ToastMsg {
  readonly _tag = "ToastMsg";
  constructor(
    public readonly type: "info" | "success" | "warning" | "error",
    public readonly title: string,
    public readonly message: string
  ) {}
}

export class ClearToastMsg {
  readonly _tag = "ClearToastMsg";
}

export class TickMsg {
  readonly _tag = "TickMsg";
  constructor(public readonly date: Date) {}
}

export class ExecuteSlashCommandMsg {
  readonly _tag = "ExecuteSlashCommandMsg";
  constructor(public readonly command: string) {}
}
