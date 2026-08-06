import React from 'react';
import { AskExpensoChat } from '../components/AskExpensoChat';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';

export function AskScreen() {
  const {
    expenses,
    monthlyBudget,
    monthlyBudgets,
    repeatMonthlyBudget,
    isJoint,
  } = useHouseholdExpenses();

  return (
    <AskExpensoChat
      expenses={expenses}
      monthlyBudget={monthlyBudget}
      monthlyBudgets={monthlyBudgets}
      repeatMonthlyBudget={repeatMonthlyBudget}
      isJoint={isJoint}
    />
  );
}
