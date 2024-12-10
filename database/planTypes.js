import { db } from './database.js';
// Create new plan type
function createPlanType(monthlyCredits, costMonthly, costYearly, name, description) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plan_type (monthly_credits, cost_monthly, cost_yearly, name, description) VALUES (?, ?, ?, ?, ?)`,
        [monthlyCredits, costMonthly, costYearly, name, description],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve available plan types
  function getPlanTypes() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM plan_type`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  // Delete a plan type
  function deletePlanType(planTypeId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM plan_type WHERE plan_type_id = ?`,
        [planTypeId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
}

module.exports = {
    createPlanType,
    getPlanTypes,
    deletePlanType,
};