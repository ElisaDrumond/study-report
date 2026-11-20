import { spec } from 'node:test/reporters';
import { Readable } from 'node:stream';

/**
 * Keep Node's native spec reporter while spacing test results.
 * Buffer partial chunks: the reporter does not guarantee that each
 * emitted chunk contains a complete line.
 */
export default async function* spacedReporter(events) {
  const formattedEvents = Readable.from(events).pipe(new spec());
  let buffer = '';

  for await (const chunk of formattedEvents) {
    buffer += String(chunk);

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      yield `${line}\n`;
      if (/^\s*(?:✔|✖)\s/.test(line)) {
        yield '\n';
      }
    }
  }

  if (buffer) {
    yield buffer;
  }
}
