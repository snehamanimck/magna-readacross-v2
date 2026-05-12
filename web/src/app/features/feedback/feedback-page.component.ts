import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ReadAcrossAppService } from '@domains/read-across';

interface IFeedbackForm {
  type: '' | 'bug' | 'idea' | 'data-issue' | 'general';
  page: '' | 'buckets' | 'heatmap' | 'insights' | 'feedback';
  initiativeId: string;
  site: string;
  description: string;
  name: string;
  priority: '' | 'low' | 'med' | 'high';
}

const EMPTY_FORM: IFeedbackForm = {
  type: '', page: '', initiativeId: '', site: '', description: '', name: '', priority: '',
};

/**
 * Give Feedback. Implements the Digi DS form pattern: a single max-3xl
 * card, paired field columns on desktop, a primary teal Submit button.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 class="text-2xl font-bold text-gray-1 tracking-tight">Give Feedback</h1>
        <p class="mt-1 text-sm text-gray-6">
          Spotted a data issue, have an idea, or seeing something off? Tell us about it.
        </p>
      </header>

      <form class="card p-6 space-y-5" (ngSubmit)="submit()">
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label class="block">
            <span class="field-label">Type<span class="text-danger-3 ml-0.5">*</span></span>
            <select required name="type" [(ngModel)]="form().type" class="select mt-1.5">
              <option value="">— Select —</option>
              <option value="bug">Bug / data error</option>
              <option value="idea">Feature idea</option>
              <option value="data-issue">Data issue</option>
              <option value="general">General comment</option>
            </select>
          </label>

          <label class="block">
            <span class="field-label">Page<span class="text-danger-3 ml-0.5">*</span></span>
            <select required name="page" [(ngModel)]="form().page" class="select mt-1.5">
              <option value="">— Select —</option>
              <option value="buckets">Initiative Overview</option>
              <option value="heatmap">Heatmap</option>
              <option value="insights">Insights &amp; Inspiration</option>
              <option value="feedback">Feedback</option>
            </select>
          </label>

          <label class="block">
            <span class="field-label">Initiative ID <span class="normal-case font-normal text-gray-7">(optional)</span></span>
            <input name="initiativeId" [(ngModel)]="form().initiativeId" class="input mt-1.5"
                   placeholder="e.g., INIT-12345" />
          </label>

          <label class="block">
            <span class="field-label">Site</span>
            <select name="site" [(ngModel)]="form().site" class="select mt-1.5">
              <option value="">— Any —</option>
              @for (s of sites(); track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </label>

          <label class="block md:col-span-2">
            <span class="field-label">Description<span class="text-danger-3 ml-0.5">*</span></span>
            <textarea required rows="5" name="description" [(ngModel)]="form().description"
                      class="textarea mt-1.5"
                      placeholder="What did you observe? What did you expect to happen?"></textarea>
          </label>

          <label class="block">
            <span class="field-label">Your name</span>
            <input name="name" [(ngModel)]="form().name" class="input mt-1.5" />
          </label>

          <label class="block">
            <span class="field-label">Priority</span>
            <select name="priority" [(ngModel)]="form().priority" class="select mt-1.5">
              <option value="">— Select —</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div class="flex items-center gap-3 pt-4 border-t border-gray-f0">
          <button type="submit" class="btn-primary" [disabled]="!isValid()">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 8 3 3 7-7" />
            </svg>
            Submit feedback
          </button>
          <button type="button" class="btn-tertiary" (click)="reset()">Reset</button>
          @if (status()) {
            <span class="ml-auto text-xs text-gray-6">{{ status() }}</span>
          }
        </div>
      </form>
    </div>
  `,
})
export class FeedbackPageComponent {
  private readonly appService = inject(ReadAcrossAppService);

  readonly form = signal<IFeedbackForm>({ ...EMPTY_FORM });
  readonly status = signal<string>('');
  readonly sites = signal<string[]>([]);

  readonly isValid = computed(() => {
    const f = this.form();
    return !!f.type && !!f.page && f.description.trim().length > 0;
  });

  constructor() {
    void this.loadSitesAsync();
  }

  submit() {
    if (!this.isValid()) return;
    const f = this.form();
    const subject = encodeURIComponent(`Magna Read-Across feedback — ${f.type}`);
    const body = encodeURIComponent([
      `Type: ${f.type}`,
      `Page: ${f.page}`,
      `Initiative ID: ${f.initiativeId}`,
      `Site: ${f.site}`,
      `Priority: ${f.priority}`,
      `Submitted by: ${f.name}`,
      ``,
      f.description,
    ].join('\n'));
    window.location.href = `mailto:greg_shannon@mckinsey.com?subject=${subject}&body=${body}`;
    this.status.set('Opened your default email client.');
  }

  reset() {
    this.form.set({ ...EMPTY_FORM });
    this.status.set('');
  }

  private async loadSitesAsync(): Promise<void> {
    const options = await this.appService.getFilterOptionsAsync();
    this.sites.set(options.sites);
  }
}
