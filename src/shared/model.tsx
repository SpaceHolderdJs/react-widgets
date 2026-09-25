import * as React from 'react';

/*
 * Where a widget's model comes from when the caller does not say.
 *
 * A default that fetches from a public CDN is a convenience for getting
 * started and a liability in production: it puts a third party in the critical
 * path of your hero, and when that third party has a bad day the widget does
 * not fail loudly — it suspends forever and you get a black canvas with no
 * error in the console. Which is exactly what it looks like when it happens.
 *
 * So: jsDelivr rather than unpkg, because it mirrors npm rather than building
 * its own index and has been the more dependable of the two for scoped
 * packages; and a boundary below that turns a failed fetch into an actual
 * message naming the URL, instead of silence.
 *
 * Serve the file yourself in anything you ship. `modelUrl` takes any URL, and
 * the models are in the package — see "Serving the models" in the README.
 */
export const cdnModelUrl = (file: string) =>
  `https://cdn.jsdelivr.net/npm/${__PKG_NAME__}@${__PKG_VERSION__}/assets/${file}`;

type Props = {
  children: React.ReactNode;
  modelUrl: string;
  onError?: (error: Error) => void;
};

type State = { error: Error | null };

/**
 * Catches a model that never arrives.
 *
 * `useGLTF` throws into Suspense, and a Suspense boundary with a null fallback
 * swallows a rejected fetch as happily as a pending one — the canvas simply
 * stays empty. This turns that into one console error naming the URL, plus an
 * `onError` callback so an application can fall back to a static image.
 */
export class ModelBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(
      `[react-widgets] the model at ${this.props.modelUrl} could not be loaded, ` +
        'so nothing will be rendered. If that is the packaged default it means the CDN ' +
        'did not serve it; pass modelUrl and serve the file yourself.',
      error,
    );
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}
