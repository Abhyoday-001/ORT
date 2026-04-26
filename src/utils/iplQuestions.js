import { GAME_CONTENT } from '../config/gameContent';

export const LATITUDE_QUESTIONS = GAME_CONTENT.round3.latitudeQuestions;
export const LONGITUDE_QUESTIONS = GAME_CONTENT.round3.longitudeQuestions;
export const IPL_QUESTIONS = GAME_CONTENT.round3.questions;

export const getQuestionsBySection = (section) => {
  if (section === 'latitude') return LATITUDE_QUESTIONS;
  if (section === 'longitude') return LONGITUDE_QUESTIONS;
  return [];
};

export const getQuestionsByTerminal = (terminalNum) => {
  if (terminalNum === 1) return LATITUDE_QUESTIONS;
  if (terminalNum === 2) return LONGITUDE_QUESTIONS;
  if (terminalNum === 3) return [];
  return [];
};
