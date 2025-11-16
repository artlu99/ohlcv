import { subDays } from "date-fns";

export const eodTimestamp = (dateTime: Date): number => {
	const dateOnly = new Date(dateTime.toLocaleDateString("en-CA"));
	return subDays(dateOnly, -1).getTime() / 1000 - 1;
};

export const pluralize = (count: number, word: string, plural= "s") => {
	return `${count} ${count === 1 ? word : `${word}${plural}`}`;
};