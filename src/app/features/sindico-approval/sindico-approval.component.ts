import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from '@angular/fire/firestore';
import { UserProfile } from '../../shared/user.model';

@Component({
  selector: 'app-sindico-approval',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sindico-approval.component.html',
  styleUrls: ['./sindico-approval.component.scss']
})
export class SindicoApprovalComponent implements OnInit {
  private app = inject(FirebaseApp);
  private db = getFirestore(this.app);

  pendingUsers: UserProfile[] = [];

  ngOnInit() {
    const usersRef = collection(this.db, 'users');
    const q = query(usersRef, where('status', '==', 'pending'));

    onSnapshot(q, (snapshot) => {
      this.pendingUsers = snapshot.docs.map(docSnap => ({
        uid: docSnap.id,
        ...docSnap.data()
      } as unknown as UserProfile));
          console.log(this.pendingUsers);
    });
  }

  async updateUserStatus(id: string, status: 'approved' | 'rejected') {
    if (!id) return;
    const userRef = doc(this.db, 'users', id);
    await updateDoc(userRef, { status });
  }
}