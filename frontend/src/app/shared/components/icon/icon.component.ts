import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AppIconName =
  | 'folder'
  | 'upload'
  | 'download'
  | 'inbox'
  | 'search'
  | 'trash'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'close'
  | 'check'
  | 'alert'
  | 'arrow-down';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @switch (name()) {
      @case ('folder') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3.75 5.5A1.75 1.75 0 0 1 5.5 3.75h2.886a1.75 1.75 0 0 1 1.236.513l1.027 1.027A.75.75 0 0 0 11.25 5.5h3.5A1.75 1.75 0 0 1 16.5 7.25v7A1.75 1.75 0 0 1 14.75 16h-9.5A1.75 1.75 0 0 1 3.5 14.25v-7c0-.464.184-.91.516-1.236L3.75 5.5Z" />
        </svg>
      }
      @case ('upload') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 2.75a.75.75 0 0 1 .75.75v7.59l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.5a.75.75 0 0 1 .75-.75Zm-6 10a.75.75 0 0 1 .75.75v1c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25v-1a.75.75 0 0 1 1.5 0v1A2.75 2.75 0 0 1 14.25 17h-9.5A2.75 2.75 0 0 1 2 14.25v-1a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('download') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 14.25a.75.75 0 0 1-.53-.22l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.75a.75.75 0 0 1 1.5 0v8.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-.53.22Zm-6 2a.75.75 0 0 1 .75.75v1c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25v-1a.75.75 0 0 1 1.5 0v1A2.75 2.75 0 0 1 14.25 17h-9.5A2.75 2.75 0 0 1 2 15.75v-1a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('inbox') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v11.5A2.25 2.25 0 0 1 15.75 18H4.25A2.25 2.25 0 0 1 2 15.75V4.25Zm2.25-.75a.75.75 0 0 0-.75.75v4.19l2.72-2.72a.75.75 0 0 1 1.06 0l2.22 2.22 2.22-2.22a.75.75 0 0 1 1.06 0l2.22 2.22 2.72-2.72V4.25a.75.75 0 0 0-.75-.75H4.25Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('search') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('trash') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.75 2A1.75 1.75 0 0 0 7.05 3.25H4.25A.75.75 0 0 0 4.25 4.5h11.5a.75.75 0 0 0 0-1.25h-2.8A1.75 1.75 0 0 0 11.2 2H8.75Zm-2.3 4.5a.75.75 0 0 0-1.06.06l-.5.5a.75.75 0 0 0 .06 1.06l.97.97-1.72 7.88A1.75 1.75 0 0 0 6.88 18h6.24a1.75 1.75 0 0 0 1.72-1.43l-1.72-7.88.97-.97a.75.75 0 0 0 .06-1.06l-.5-.5a.75.75 0 0 0-1.06-.06L10 9.44 8.51 7.95a.75.75 0 0 0-1.06-.06Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('document') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8h-3a1 1 0 0 1-1-1V4H6Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('image') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm2.25-.75a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-9.5a.75.75 0 0 0-.75-.75H3.25ZM6 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11.25 4.562-3.182-3.182a.75.75 0 0 0-1.06 0L9.25 14.44 7.78 12.97a.75.75 0 0 0-1.06 0L4.5 15.19v-.444a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75v.062Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('video') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM16.28 6.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 0 1-1.28-.53V6.75a.75.75 0 0 1 .22-.53Z" />
        </svg>
      }
      @case ('audio') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10.75 3.5a.75.75 0 0 0-1.5 0v8.614L6.295 8.835a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V3.5Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
        </svg>
      }
      @case ('archive') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h11A1.5 1.5 0 0 1 17 3.5v2A1.5 1.5 0 0 1 15.5 7h-11A1.5 1.5 0 0 1 3 5.5v-2ZM4.5 4a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-11Z" />
          <path d="M4 8.75A1.75 1.75 0 0 1 5.75 7h8.5A1.75 1.75 0 0 1 16 8.75v7.5A1.75 1.75 0 0 1 14.25 18h-8.5A1.75 1.75 0 0 1 4 16.25v-7.5ZM5.75 8.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-8.5Z" />
        </svg>
      }
      @case ('close') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      }
      @case ('check') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414L9 11.586l6.52-6.52a1 1 0 0 1 1.414 0Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('alert') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
        </svg>
      }
      @case ('arrow-down') {
        <svg [class]="class()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v8.19l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 1 1 1.06-1.06l2.47 2.47V3.75A.75.75 0 0 1 10 3Z" clip-rule="evenodd" />
        </svg>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<AppIconName>();
  readonly class = input<string>('h-4 w-4 shrink-0');
}
