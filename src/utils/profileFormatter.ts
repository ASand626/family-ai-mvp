import { calculateAge } from './age';

interface Profile {
  family_summary?: string;
  concerns?: string;
}

interface FamilyMember {
  role: string;
  nickname: string;
  birthdate?: string | null;
  occupation?: string | null;
  recent_concern?: string | null;
  school_status?: string | null;
  interests?: string[] | null;
  concerns?: string[] | null;
}

/**
 * Formats family profile and family members data into a structured markdown block
 * that is optimized for LLMs (Claude) system instructions context.
 */
export function formatProfileForAI(profile: Profile | null | undefined, members: FamilyMember[]): string {
  let result = "【相談者の家庭プロフィール】\n";

  if (profile?.family_summary) {
    result += `全体の家族構成・概要: ${profile.family_summary}\n`;
  }
  if (profile?.concerns) {
    result += `家族全体の最近の困りごと: ${profile.concerns}\n`;
  }

  if (members && members.length > 0) {
    result += "\n家族メンバーの詳細:\n";
    
    // Format Parents information
    const parents = members.filter(m => m.role === 'parent');
    parents.forEach((parent, index) => {
      const age = calculateAge(parent.birthdate);
      const label = parent.nickname || `親 ${index + 1}`;
      result += `- ${label} (親):\n`;
      if (age) result += `  * 年齢: ${age}\n`;
      if (parent.occupation) result += `  * 勤務状況: ${parent.occupation}\n`;
      if (parent.recent_concern) result += `  * 最近の困りごと: ${parent.recent_concern}\n`;
    });

    // Format Children information
    const children = members.filter(m => m.role === 'child');
    children.forEach((child, index) => {
      const age = calculateAge(child.birthdate);
      const label = child.nickname || `子ども ${index + 1}`;
      result += `- ${label} (子ども):\n`;
      if (age) result += `  * 年齢: ${age}\n`;
      if (child.school_status) result += `  * 通園状況: ${child.school_status}\n`;
      if (child.interests && child.interests.length > 0) {
        result += `  * 好きなこと・興味: ${child.interests.join(', ')}\n`;
      }
      if (child.concerns && child.concerns.length > 0) {
        result += `  * 気になること・心配事: ${child.concerns.join(', ')}\n`;
      }
    });
  }

  return result;
}
