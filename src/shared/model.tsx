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

/** Is this one of our own CDN URLs, rather than something the caller passed? */
const isPackagedDefault = (url: string) =>
  url.startsWith(`https://cdn.jsdelivr.net/npm/${__PKG_NAME__}@${__PKG_VERSION__}/assets/`);

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
    // The likeliest reason the packaged default 404s is not a CDN outage: it
    // is a build of this package that has not been published. The URL carries
    // the package's own version, so a local or prerelease build points at a
    // version npm has never seen, and jsDelivr can only mirror what is there.
    // Worth saying outright — it is otherwise a black canvas and a guess.
    const hint = isPackagedDefault(this.props.modelUrl)
      ? ` This is the packaged default, which is built from this package's own version (${__PKG_VERSION__}). ` +
        'If you are running a local or unpublished build, that version is not on npm yet and the CDN has ' +
        'nothing to serve — point modelUrl at your own copy (the files are in the package under assets/). ' +
        'Otherwise the CDN did not serve it, and you should be serving it yourself in production anyway.'
      : '';

    // eslint-disable-next-line no-console
    console.error(
      `[react-widgets] the model at ${this.props.modelUrl} could not be loaded, ` +
        `so nothing will be rendered.${hint}`,
      error,
    );
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}
