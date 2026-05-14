import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ReadAcrossAppService } from '@domains/read-across';
import { DashboardChromeService } from '@app/core-services';

interface IFeedbackForm {
  type: '' | 'bug' | 'idea' | 'data-issue' | 'general';
  page: 'general' | 'buckets' | 'heatmap' | 'insights' | 'feedback';
  initiativeId: string;
  site: string;
  description: string;
  name: string;
  priority: '' | 'low' | 'med' | 'high';
}

const EMPTY_FORM: IFeedbackForm = {
  type: '', page: 'general', initiativeId: '', site: '', description: '', name: '', priority: '',
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
    <div class="flex flex-col gap-4 max-w-[760px] mx-auto w-full">
      <header>
        <h1 class="text-[30px] font-bold text-gray-1 tracking-tight">Give Feedback</h1>
        <p class="mt-1 text-[13px] text-gray-6">
          Your feedback helps us improve the dashboard. Clicking Submit will open a pre-filled
          email in your email client.
        </p>
      </header>

      <form class="card p-5 space-y-4" (ngSubmit)="submit()">
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label class="block">
            <span class="field-label">Feedback type<span class="text-danger-3 ml-0.5">*</span></span>
            <select required name="type"
                    [ngModel]="form().type"
                    (ngModelChange)="patchForm('type', $event)"
                    class="select mt-1.5">
              <option value="">Select feedback type...</option>
              <option value="bug">Bug / data error</option>
              <option value="idea">Feature idea</option>
              <option value="data-issue">Data issue</option>
              <option value="general">General comment</option>
            </select>
          </label>

          <label class="block md:col-span-2">
            <span class="field-label">Which page does this relate to?</span>
            <select name="page"
                    [ngModel]="form().page"
                    (ngModelChange)="patchForm('page', $event)"
                    class="select mt-1.5">
              <option value="general">General / not page-specific</option>
              <option value="buckets">Initiative Overview</option>
              <option value="heatmap">Heatmap</option>
              <option value="insights">Insights &amp; Inspiration</option>
              <option value="feedback">Feedback</option>
            </select>
          </label>

          <label class="block">
            <span class="field-label">Initiative ID</span>
            <input name="initiativeId"
                   [ngModel]="form().initiativeId"
                   (ngModelChange)="patchForm('initiativeId', $event)"
                   class="input mt-1.5"
                   placeholder="e.g., 12194" />
          </label>

          <label class="block">
            <span class="field-label">Site</span>
            <select name="site"
                    [ngModel]="form().site"
                    (ngModelChange)="patchForm('site', $event)"
                    class="select mt-1.5">
              <option value="">Select a site...</option>
              @for (s of sites(); track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </label>

          <label class="block md:col-span-2">
            <span class="field-label">Description<span class="text-danger-3 ml-0.5">*</span></span>
            <textarea required rows="5" name="description"
                      [ngModel]="form().description"
                      (ngModelChange)="patchForm('description', $event)"
                      class="textarea mt-1.5"
                      placeholder="Describe what you noticed, what you expected, or what you'd like to see..."></textarea>
          </label>

          <label class="block">
            <span class="field-label">Your name</span>
            <input name="name"
                   [ngModel]="form().name"
                   (ngModelChange)="patchForm('name', $event)"
                   class="input mt-1.5"
                   placeholder="Optional — helps us follow up" />
          </label>

          <label class="block">
            <span class="field-label">Priority</span>
            <select name="priority"
                    [ngModel]="form().priority"
                    (ngModelChange)="patchForm('priority', $event)"
                    class="select mt-1.5">
              <option value="">Select priority...</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button type="submit"
                  class="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold
                         bg-magna-red text-white hover:bg-[#a30e26]
                         disabled:opacity-50 disabled:cursor-not-allowed"
                  [disabled]="!isValid()">
            Submit Feedback
          </button>
          @if (status()) {
            <span class="text-xs text-gray-6">{{ status() }}</span>
          }
        </div>
      </form>
    </div>
  `,
})
export class FeedbackPageComponent {
  private readonly appService = inject(ReadAcrossAppService);
  private readonly chrome     = inject(DashboardChromeService);

  readonly form = signal<IFeedbackForm>({ ...EMPTY_FORM });
  readonly status = signal<string>('');
  readonly sites = signal<string[]>([]);

  readonly isValid = computed(() => {
    const f = this.form();
    return !!f.type && f.description.trim().length > 0;
  });

  constructor() {
    void this.loadSitesAsync();
  }

  submit() {
    if (!this.isValid()) return;
    const f = this.form();
    const subject = encodeURIComponent(`[Magna Dashboard Feedback] ${f.type}${f.page ? ` - ${f.page}` : ''}`);
    const body = encodeURIComponent([
      `Feedback Type: ${f.type}`,
      ...(f.page && f.page !== 'general' ? [`Page/Section: ${f.page}`] : []),
      ...(f.initiativeId ? [`Initiative ID: ${f.initiativeId}`] : []),
      ...(f.site ? [`Site: ${f.site}`] : []),
      ...(f.priority ? [`Priority: ${f.priority}`] : []),
      '',
      'Description:',
      f.description,
      '',
      '---',
      ...(f.name ? [`Submitted by: ${f.name}`] : []),
    ].join('\n'));
    // Recipient comes from `dashboard-config.feedbackEmail` so DevOps can
    // re-target the form without a code change. Falls back to the same
    // default the chrome service uses if the config has not loaded yet.
    const recipient = encodeURIComponent(this.chrome.feedbackEmail());
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    this.status.set('✓ Email opened — please send it from your email client.');
  }

  private async loadSitesAsync(): Promise<void> {
    const options = await this.appService.getFilterOptionsAsync();
    this.sites.set(options.sites);
  }

  protected patchForm<K extends keyof IFeedbackForm>(key: K, value: IFeedbackForm[K]): void {
    this.form.update(prev => ({ ...prev, [key]: value }));
  }
}
