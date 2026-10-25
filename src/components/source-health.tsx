import { useMutation, useQuery } from 'convex/react';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../convex/_generated/api';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { AirportCode } from '@/data/types';
import { formatDateTime } from '@/lib/format';

const HEALTH_LABEL = { ok: 'OK', stale: 'Not crawled recently', error: 'Last crawl failed' } as const;

/** Crawl status for each source page, so a broken scraper is noticed before the data goes stale. */
export function SourceHealth({ reviewKey, airportCode }: { reviewKey: string; airportCode: AirportCode }) {
  const data = useQuery(api.review.sources, { reviewKey, airportCode });
  const runScrapeNow = useMutation(api.review.runScrapeNow);
  const [starting, setStarting] = useState(false);

  async function handleRunNow() {
    setStarting(true);
    try {
      await runScrapeNow({ reviewKey });
      Alert.alert('Scrape requested', 'New results show up here once the Apify run finishes, usually within a few minutes.');
    } catch (error) {
      Alert.alert('Could not start scrape', (error as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (data === undefined) return null;
  const { lastRun, sources } = data;

  return (
    <Card>
      <ThemedText type="subtitle">Sources</ThemedText>

      {sources.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No sources for {airportCode} yet. Run `npx convex run seed:sources`.
        </ThemedText>
      )}

      {sources.map((source) => (
        <View key={source._id} style={styles.source}>
          <Pill variant={source.health === 'ok' ? 'success' : 'estimate'}>{HEALTH_LABEL[source.health]}</Pill>
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(source.url)}
            accessibilityRole="link"
            accessibilityLabel={`Open ${source.url}`}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="primary">
              {source.url}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            Crawled {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : 'never'}
            {' · '}
            Content changed {source.lastChangedAt ? formatDateTime(source.lastChangedAt) : 'never'}
          </ThemedText>
          {source.lastError && (
            <ThemedText type="small" themeColor="textSecondary">
              {source.lastError}
            </ThemedText>
          )}
        </View>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        {lastRun
          ? `Last run ${formatDateTime(lastRun.startedAt)} (${lastRun.trigger}): ${lastRun.status}${lastRun.error ? ` — ${lastRun.error}` : ''}`
          : 'No scheduled run yet. Runs every Monday 14:00 UTC.'}
      </ThemedText>
      <Button label="Run scraper now" variant="secondary" onPress={() => void handleRunNow()} disabled={starting} />
    </Card>
  );
}

const styles = StyleSheet.create({
  source: {
    gap: Spacing.one,
  },
});
