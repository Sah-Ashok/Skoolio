import {
  getActivityLogs,
  getDistinctModules,
  purgeOldLogsForSchool,
  purgeAllOldLogs,
  GetHistoryFilters,
} from '../Repositories/history.repository';

export async function getHistoryService(filters: GetHistoryFilters) {
  return getActivityLogs(filters);
}

export async function getDistinctModulesService(school_id: number) {
  return getDistinctModules(school_id);
}

/**
 * Super admin: purge logs older than 3 months for one school.
 */
export async function purgeSchoolHistoryService(school_id: number) {
  const deleted = await purgeOldLogsForSchool(school_id);
  return { deleted };
}

/**
 * Super admin: purge logs older than 3 months across all schools.
 */
export async function purgeAllHistoryService() {
  const deleted = await purgeAllOldLogs();
  return { deleted };
}
