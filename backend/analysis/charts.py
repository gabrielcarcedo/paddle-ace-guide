# Chart generation utilities for analysis
from __future__ import annotations
import os
from typing import List, Dict

# Use non-interactive backend
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def _safe_len(x: List) -> int:
    try:
        return len(x)
    except Exception:
        return 0


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def generate_charts(
    output_dir: str,
    *,
    list_mun_izq_ancho: List[float],
    list_mun_der_ancho: List[float],
    list_mun_izq: List[float],
    list_mun_der: List[float],
    list_angle_axi_izq: List[float],
    list_angle_axi_der: List[float],
    list_head_alt: List[float],
    list_hip: List[float],
    list_stroke_rate: List[float],
    list_aux: List[float],
) -> Dict[str, str]:
    """
    Generate analysis charts and save them to output_dir.
    Returns a dict of {key: filename} for each generated image.
    """
    _ensure_dir(output_dir)

    # Build DataFrame similar to user's reference
    df = pd.DataFrame({
        'list_mun_izq_ancho': pd.Series(list_mun_izq_ancho, dtype=float),
        'list_mun_der_ancho': pd.Series(list_mun_der_ancho, dtype=float),
        'list_mun_izq': pd.Series(list_mun_izq, dtype=float),
        'list_mun_der': pd.Series(list_mun_der, dtype=float),
        'list_head_alt': pd.Series(list_head_alt, dtype=float),
        'list_hip': pd.Series(list_hip, dtype=float),
        'list_angle_axi_izq': pd.Series(list_angle_axi_izq, dtype=float),
        'list_angle_axi_der': pd.Series(list_angle_axi_der, dtype=float),
    })

    n = max(_safe_len(list_mun_izq), _safe_len(list_mun_der), 1)

    # Precompute counts for bubble sizes
    df['list_mun_izq_counts'] = df['list_mun_izq'].map(df['list_mun_izq'].value_counts()).fillna(0)
    df['list_mun_der_counts'] = df['list_mun_der'].map(df['list_mun_der'].value_counts()).fillna(0)

    results: Dict[str, str] = {}

    # 1) Right hand position distribution
    try:
        fig, ax = plt.subplots(figsize=(8, 5), dpi=100)
        sizes = (df['list_mun_der_counts'] / max(n, 1)) * 3000
        sc = ax.scatter(df['list_mun_der_ancho'], df['list_mun_der'], c=(df['list_mun_der_counts'] / max(n, 1)),
                        s=sizes, marker='o', alpha=0.5, cmap=plt.get_cmap('jet'))
        plt.colorbar(sc)
        ax.plot(df['list_mun_der_ancho'], df['list_mun_der'], linestyle='solid', color='green', markersize=3, linewidth=2, alpha=0.1)
        ax.set_title('Right hand position distribution', fontsize=12)
        ax.set_xlabel('width(px)', fontsize=10)
        ax.set_ylabel('height(px)', fontsize=10)
        ax.grid(True, color='gray', linestyle='dashed', alpha=0.7)
        fname = 'right_hand_position_distribution.png'
        fig.savefig(os.path.join(output_dir, fname), dpi=200, bbox_inches='tight')
        plt.close(fig)
        results['right_hand_distribution'] = fname
    except Exception:
        pass

    # 2) Left hand position distribution
    try:
        fig, ax = plt.subplots(figsize=(8, 5), dpi=100)
        sizes = (df['list_mun_izq_counts'] / max(n, 1)) * 3000
        sc = ax.scatter(df['list_mun_izq_ancho'], df['list_mun_izq'], c=(df['list_mun_izq_counts'] / max(n, 1)),
                        s=sizes, marker='o', alpha=0.5, cmap=plt.get_cmap('jet'))
        plt.colorbar(sc)
        ax.plot(df['list_mun_izq_ancho'], df['list_mun_izq'], linestyle='solid', color='green', markersize=3, linewidth=2, alpha=0.1)
        ax.set_title('Left hand position distribution', fontsize=12)
        ax.set_xlabel('width(px)', fontsize=10)
        ax.set_ylabel('height(px)', fontsize=10)
        ax.grid(True, color='gray', linestyle='dashed', alpha=0.7)
        fname = 'left_hand_position_distribution.png'
        fig.savefig(os.path.join(output_dir, fname), dpi=200, bbox_inches='tight')
        plt.close(fig)
        results['left_hand_distribution'] = fname
    except Exception:
        pass

    # 3) Armpit angles distribution in first 10 seconds (~ first 300 frames if 30fps)
    try:
        m = min(len(df['list_angle_axi_izq']), 300)
        fig, ax = plt.subplots(figsize=(20, 5), dpi=100)
        ax.stackplot(np.arange(m), df['list_angle_axi_izq'][:m], color='lightgreen', alpha=0.8)
        ax.stackplot(np.arange(m), df['list_angle_axi_der'][:m], color='yellow', alpha=0.5)
        ax.plot(np.arange(m), df['list_angle_axi_izq'][:m], linestyle='solid', color='green', linewidth=2, label='Left armpit')
        ax.plot(np.arange(m), df['list_angle_axi_der'][:m], linestyle='solid', color='red', linewidth=2, label='Right armpit')
        ax.set(title="Armpit's angles distribution in first 10 seconds", xlabel='frames', ylabel='angles(°)')
        ax.grid(True, color='gray', linestyle='dashed')
        ax.legend(loc='upper left')
        ax.set_facecolor('white')
        fname = 'armpit_angles_first.png'
        fig.savefig(os.path.join(output_dir, fname), dpi=200, bbox_inches='tight')
        plt.close(fig)
        results['armpit_angles_first'] = fname
    except Exception:
        pass

    # 4) Distribution of strokes vs head and hip in first 10 seconds
    try:
        m = min(len(df['list_mun_izq']), 300)
        fig, ax = plt.subplots(figsize=(20, 5), dpi=100)
        ax.plot(np.arange(m), df['list_mun_izq'][:m], linestyle='solid', color='green', linewidth=2, label='Left hand')
        ax.plot(np.arange(m), df['list_mun_der'][:m], linestyle='solid', color='red', linewidth=2, label='Right hand')
        ax.plot(np.arange(min(len(df['list_head_alt']), m)), df['list_head_alt'][:m], linestyle='dashed', color='darkblue', linewidth=2, label='Head')
        ax.plot(np.arange(min(len(df['list_hip']), m)), df['list_hip'][:m], linestyle='dashed', color='black', linewidth=2, label='Hip')
        ax.set(title='Distribution of strokes in first 10 seconds', xlabel='frames', ylabel='height(px)')
        ax.grid(True, color='gray', linestyle='dashed')
        ax.legend(loc='upper left')
        ax.set_facecolor('white')
        fname = 'strokes_distribution_first.png'
        fig.savefig(os.path.join(output_dir, fname), dpi=200, bbox_inches='tight')
        plt.close(fig)
        results['strokes_distribution_first'] = fname
    except Exception:
        pass

    # 5) Stroke rate variation in time
    try:
        if len(list_stroke_rate) > 1 and len(list_aux) > 1:
            y = float(np.mean(list_stroke_rate[1:]))
            x = np.array(list_aux[1:])
            sr = np.array(list_stroke_rate[1:])
            fig, ax = plt.subplots(figsize=(20, 5), dpi=100)
            ax.plot(x, sr, linestyle='dashed', color='black', markersize=6, linewidth=2, marker='o', label='spm')
            ax.axhline(y, color='r', linestyle='-', label='mean')
            ax.fill_between(x, y - np.std(sr), y + np.std(sr), alpha=0.3, edgecolor='#1B2ACC', facecolor='#089FFF',
                            linewidth=2, linestyle='dotted', antialiased=True, label='std')
            ax.set_title('Stroke rate variation in time', fontsize=15)
            ax.set_xlabel('Time (s)', fontsize=15)
            ax.set_ylabel('Strokes/min', fontsize=15)
            ax.grid(True, color='cyan', linestyle='dashed', alpha=0.5)
            ax.set_facecolor('white')
            ax.legend()
            # Optional fixed y-lims similar to user's example
            # ax.set_ylim(61, 73)
            fname = 'stroke_rate_variation.png'
            fig.savefig(os.path.join(output_dir, fname), dpi=200, bbox_inches='tight')
            plt.close(fig)
            results['stroke_rate_variation'] = fname
    except Exception:
        pass

    return results
