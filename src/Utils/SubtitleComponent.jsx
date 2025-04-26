import React from 'react';

const SubtitleComponent = () => {
    const subtitleStyle = {
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#F9FFFB',
        fontSize: '16px',
        fontFamily: 'Roboto, sans-serif',
        fontWeight: '600',
        fontStyle: 'italic',
        textAlign: 'center',
        zIndex: '1000',
        padding: '8px 16px',
        pointerEvents: 'none',
        width: '90%',
        whiteSpace: 'pre-line'
    };

    return (
        <div style={subtitleStyle}>
            {'”Pour les amateurs de défis en pleine nature, l’association *grésillement* lance un défi à ses bénévoles : capturer en photo un vison d’Europe albinos, \n' +
                'une espèce quasiment introuvable aujourd’hui. Une récompense pour le cliché le plus saisissant !”'}
        </div>
    );
};

export default SubtitleComponent;