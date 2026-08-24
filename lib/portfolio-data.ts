import { adaptArtifactRecords, MAIN_PROJECTION_ID } from "./portfolio-adapter";
import { artifacts } from "./portfolio";
import {
  createPortfolioModel,
  type PortfolioModel,
  type PortfolioProjection,
  type PortfolioStageData,
} from "./portfolio-model";

export { MAIN_PROJECTION_ID } from "./portfolio-adapter";

const model = createPortfolioModel(adaptArtifactRecords(artifacts));
const selectedProjection = model.getProjection(MAIN_PROJECTION_ID);
if (!selectedProjection) {
  throw new Error(`Missing projection: ${MAIN_PROJECTION_ID}`);
}

export const portfolioData: PortfolioStageData = model.data;
export const mainProjection: PortfolioProjection = selectedProjection;
export const getProject: PortfolioModel["getProject"] = model.getProject;
export const getEntity: PortfolioModel["getEntity"] = model.getEntity;
export const getProjection: PortfolioModel["getProjection"] = model.getProjection;
export const getBranch: PortfolioModel["getBranch"] = model.getBranch;
export const getBranchEntities: PortfolioModel["getBranchEntities"] =
  model.getBranchEntities;
