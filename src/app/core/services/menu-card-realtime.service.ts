import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MenuCardRealtimeService implements OnDestroy {
  private pusher: Pusher | null = null;
  private channelName: string | null = null;
  private channel: { bind: (event: string, cb: (d: any) => void) => void } | null = null;

  readonly menuCardUpdated$ = new Subject<number>();

  constructor() {}

  subscribe(locationId: number): void {
    if (this.channelName === `menu-card.${locationId}`) {
      return;
    }
    this.unsubscribe();
    if (!environment.pusherKey || environment.pusherKey === 'your-pusher-key') {
      return;
    }
    try {
      this.pusher = new Pusher(environment.pusherKey, {
        cluster: environment.pusherCluster || 'ap2'
      });
      this.channelName = `menu-card.${locationId}`;
      this.channel = this.pusher.subscribe(this.channelName);
      this.channel.bind('MenuCardUpdated', (data: { location_id: number }) => {
        this.menuCardUpdated$.next(data?.location_id ?? locationId);
      });
    } catch (err) {
      console.warn('MenuCardRealtime: Pusher init failed', err);
    }
  }

  unsubscribe(): void {
    if (this.channel && this.pusher) {
      this.pusher.unsubscribe(this.channelName!);
      this.channel = null;
      this.channelName = null;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe();
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
  }
}
