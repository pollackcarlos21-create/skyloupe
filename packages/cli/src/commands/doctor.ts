import { scanProject, formatDoctorReport } from "../doctor/astScanner";

export function runDoctor(root: string): { code: number; text: string } {
  const started = Date.now();
  const { files, findings } = scanProject(root);
  const text = formatDoctorReport(files, findings, Date.now() - started);
  return { code: findings.some((finding) => finding.severity === "error") ? 1 : 0, text };
}
