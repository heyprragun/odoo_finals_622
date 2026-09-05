import type { NextFunction, Request, Response } from "express";
import * as governanceService from "../services/governance.service";
import type { UpdateGovernanceSettingsInput } from "../validation/governance.validation";

export async function getGovernanceSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await governanceService.getGovernanceSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

export async function updateGovernanceSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as UpdateGovernanceSettingsInput;
    const settings = await governanceService.updateGovernanceSettings(input);
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}
