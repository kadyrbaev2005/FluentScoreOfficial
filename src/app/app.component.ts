import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, HttpClientModule],
  template: `
    <div class="container">
      <h1>IELTS Speaking MVP (Angular)</h1>

      <button (click)="startRecording()" [disabled]="isRecording">Start Recording</button>
      <button (click)="stopRecording()" [disabled]="!isRecording">Stop Recording</button>
      <button (click)="sendAudioToServer()" [disabled]="!audioBlob">Send to Server</button>

      <div *ngIf="transcript">
        <h3>Transcript:</h3>
        <p>{{ transcript }}</p>
      </div>

      <div *ngIf="score !== null">
        <h3>Approx IELTS Score: {{ score }}</h3>
      </div>

      <div *ngIf="errorMessage" class="error">
        <h3>Error:</h3>
        <p>{{ errorMessage }}</p>
      </div>
    </div>
  `
})
export class AppComponent {
  isRecording = false;
  private mediaRecorder!: MediaRecorder;
  private chunks: Blob[] = [];
  transcript: string = '';
  score: number | null = null;
  audioBlob: Blob | null = null;
  errorMessage: string = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  startRecording() {
    this.chunks = [];
    this.transcript = '';
    this.score = null;
    this.audioBlob = null;
    this.errorMessage = '';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.mediaRecorder = new MediaRecorder(stream);
          this.mediaRecorder.start();
          this.isRecording = true;

          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              this.chunks.push(event.data);
            }
          };

          this.mediaRecorder.onstop = async () => {
            this.audioBlob = new Blob(this.chunks, { type: 'audio/webm' });

            console.log('Audio blob создан:', this.audioBlob);
            
            // 🔥 Принудительно обновляем UI
            this.cdr.detectChanges();
          };
        })
        .catch(err => {
          this.errorMessage = 'Ошибка доступа к микрофону: ' + err.message;
          console.error(this.errorMessage);
        });
    } else {
      this.errorMessage = 'MediaDevices API не поддерживается в этом браузере.';
      console.error(this.errorMessage);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    } else {
      console.warn('Попытка остановить запись, когда mediaRecorder не активен');
    }
  }

  sendAudioToServer() {
    if (!this.audioBlob) {
      this.errorMessage = 'Ошибка: аудиофайл не создан!';
      console.error(this.errorMessage);
      return;
    }

    const formData = new FormData();
    formData.append('file', this.audioBlob, 'user_audio.webm');

    console.log('Отправка аудиофайла на сервер...');

    this.http.post<any>('https://only-backend-wsrw.onrender.com/upload-audio', formData)
      .subscribe({
        next: (res) => {
          console.log('Ответ сервера:', res);
          if (res.transcript) {
            this.transcript = res.transcript;
          }
          if (res.analysis && res.analysis.ielts_score_approx) {
            this.score = res.analysis.ielts_score_approx;
          }
        },
        error: (err) => {
          this.errorMessage = 'Ошибка при отправке файла: ' + err.message;
          console.error(this.errorMessage);
        }
      });
  }
}
