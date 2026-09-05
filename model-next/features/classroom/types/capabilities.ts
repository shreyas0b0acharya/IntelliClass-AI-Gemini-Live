export interface ClassroomCapabilities {
  canAskDoubt: boolean;
  canEditCurriculum: boolean;
  canControlSession: boolean;
  canViewMaterials: boolean;
  canViewParticipants: boolean;
  canModerateParticipants: boolean;
  canShareSession: boolean;
}

export function getCapabilities(role: "lecturer" | "student"): ClassroomCapabilities {
  const isLecturer = role === "lecturer";
  return {
    canAskDoubt: !isLecturer,
    canEditCurriculum: isLecturer,
    canControlSession: isLecturer,
    canViewMaterials: true,
    canViewParticipants: true,
    canModerateParticipants: isLecturer,
    canShareSession: true,
  };
}
