import { ProjectIndex } from "../../components/ProjectIndex";
import { portfolioData } from "../../lib/portfolio-data";

export default function WorkIndex() {
  return <ProjectIndex projects={portfolioData.projects} />;
}
