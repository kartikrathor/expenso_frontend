import React from 'react';
import { AskExpensoChat } from '../components/AskExpensoChat';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';

export function AskScreen() {
  const { expenses, monthlyBudget, isJoint } = useHouseholdExpenses();

  return (
    <AskExpensoChat
      expenses={expenses}
      monthlyBudget={monthlyBudget}
      isJoint={isJoint}
    />
  );
}
