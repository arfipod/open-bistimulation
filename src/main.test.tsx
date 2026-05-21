import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot,
}));

vi.mock('./app/App', () => ({
  default: () => <div>app</div>,
}));

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.render.mockReset();
    mocks.createRoot.mockReset().mockReturnValue({ render: mocks.render });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the React app into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./main');

    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when #root is missing', async () => {
    document.body.innerHTML = '';

    await expect(import('./main')).rejects.toThrow('Root element #root was not found.');
  });
});
