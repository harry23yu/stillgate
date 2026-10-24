import type { Itinerary } from '@/data/itinerary';
import type { GuideNarrationRequest, GuideStepId } from '@/data/guide-audio-provider';
import type { FlightLookup } from '@/data/types';
import { formatTime } from '@/lib/format';

export function buildGuideNarration(
  stepId: GuideStepId,
  itinerary: Itinerary,
  flight: FlightLookup,
): GuideNarrationRequest {
  const departureTime = formatTime(flight.scheduledDeparture);
  const destination = flight.destination?.city ?? flight.destination?.code;
  let transcript: string;

  switch (stepId) {
    case 'trip':
      transcript = `Let's get ready for flight ${flight.flight}, departing ${flight.origin.city} at ${departureTime}${destination ? ` for ${destination}` : ''}.${flight.gate ? ` Your current gate is ${flight.gate}.` : ' Your gate has not been posted yet.'}`;
      break;
    case 'arrival':
      transcript = `Aim to arrive at ${flight.origin.city} by ${formatTime(itinerary.recommendedArrival.time)}. This is an estimate with about ${itinerary.recommendedArrival.bufferMinutes} minutes of time before departure.`;
      break;
    case 'checkpoint':
      transcript = itinerary.recommendedCheckpoint
        ? `The ${itinerary.recommendedCheckpoint.checkpoint} checkpoint is currently estimated at ${itinerary.recommendedCheckpoint.waitMinutes} minutes. The wait can change.`
        : `Checkpoint wait information is not available for ${flight.origin.city} right now.`;
      break;
    case 'security':
      transcript = `${itinerary.tsaReminder.text}${itinerary.visaReminder ? ` ${itinerary.visaReminder.text}` : ''}`;
      break;
    case 'post-security': {
      const gateText = flight.gate ? `Head toward gate ${flight.gate}.` : 'Your gate has not been posted yet, so check your airline for an update.';
      const quietText = itinerary.postSecurity.quietOption?.canMakeIt
        ? `A quieter place nearby is ${itinerary.postSecurity.quietOption.place.name}.`
        : '';
      const foodText = itinerary.postSecurity.foodOption?.canMakeIt
        ? `A food option nearby is ${itinerary.postSecurity.foodOption.place.name}.`
        : '';
      transcript = `${gateText} ${quietText} ${foodText}`.trim();
      break;
    }
  }

  return {
    stepId,
    transcript,
    flight: {
      flightNumber: flight.flight,
      departureAirport: flight.origin.code,
      destinationAirport: flight.destination?.code ?? null,
      gate: flight.gate,
      departureTime: flight.scheduledDeparture,
    },
    leaveByTime: stepId === 'arrival' ? itinerary.recommendedArrival.time : null,
  };
}
